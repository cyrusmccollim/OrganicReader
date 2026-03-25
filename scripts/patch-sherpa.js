// Patches react-native-sherpa-onnx-offline-tts to:
// 1. Make initializeTTS async (Promise param, background thread) [Android]
// 2. Support lexiconPath, dictDirPath, and speakerId for MeloTTS [Android + iOS]
const fs = require('fs');
const path = require('path');

const PKG = path.join(__dirname, '../node_modules/react-native-sherpa-onnx-offline-tts');

// ── Android ──────────────────────────────────────────────────────────────────

function patchAndroid() {
  const target = path.join(PKG, 'android/src/main/java/com/sherpaonnxofflinetts/TTSManagerModule.kt');
  if (!fs.existsSync(target)) { console.log('patch-sherpa: android target not found, skipping'); return; }

  let src = fs.readFileSync(target, 'utf8');
  if (src.includes('currentSpeakerId')) { console.log('patch-sherpa: android already patched'); return; }

  src = src.replace(
    /\/\/ Initialize TTS and Audio Player[\s\S]*?fun initializeTTS\(sampleRate: Double, channels: Int, modelId: String(?:, promise: Promise)?\) \{[\s\S]*?(?:promise\.resolve\(null\)\s*\} catch \(e: Exception\) \{\s*promise\.reject\("INIT_ERROR", e\.message \?\: "TTS initialization failed"\)\s*\}\s*\}\s*\}|realTimeAudioPlayer\?\.start\(\)\s*\n\s*\})/,
    `// Initialize TTS and Audio Player -- runs on background thread to avoid blocking the JS bridge
    @ReactMethod
    fun initializeTTS(sampleRate: Double, channels: Int, modelId: String, promise: Promise) {
        thread {
            try {
                val player = AudioPlayer(sampleRate.toInt(), channels, object : AudioPlayerDelegate {
                    override fun didUpdateVolume(volume: Float) {
                        sendVolumeUpdate(volume)
                        if (volume == -1f) {
                            if (stopping) return
                            val p = pendingPromise
                            pendingPromise = null
                            p?.resolve("Playback finished")
                        }
                    }
                })
                realTimeAudioPlayer = player

                val jsonObject = JSONObject(modelId)
                val modelPath = jsonObject.getString("modelPath")
                val tokensPath = jsonObject.getString("tokensPath")
                val dataDirPath = jsonObject.optString("dataDirPath", "")
                val lexiconPath = jsonObject.optString("lexiconPath", "")
                val dictDirPath = jsonObject.optString("dictDirPath", "")
                currentSpeakerId = jsonObject.optInt("speakerId", 0)

                val config = OfflineTtsConfig(
                    model = OfflineTtsModelConfig(
                        vits = OfflineTtsVitsModelConfig(
                            model = modelPath,
                            tokens = tokensPath,
                            dataDir = dataDirPath,
                            lexicon = lexiconPath,
                            dictDir = dictDirPath,
                        ),
                        numThreads = 2,
                        debug = false,
                    )
                )

                tts = OfflineTts(config = config)
                player.start()

                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("INIT_ERROR", e.message ?: "TTS initialization failed")
            }
        }
    }`,
  );

  if (!src.includes('var currentSpeakerId')) {
    src = src.replace(
      /private var tts: OfflineTts\? = null/,
      `private var tts: OfflineTts? = null
    private var currentSpeakerId: Int = 0`,
    );
  }

  // Fix sid=0 in real-time generateAudio
  src = src.replace(
    /val audio = tts!!\.generate\(text = processed, sid = 0,/g,
    'val audio = tts!!.generate(text = processed, sid = currentSpeakerId,',
  );

  // Fix sid=0 in generateAndSave (uses local `engine` variable, positional args)
  src = src.replace(
    /engine\.generate\(processed, 0, 1\.0f\)/g,
    'engine.generate(processed, currentSpeakerId, 1.0f)',
  );

  fs.writeFileSync(target, src, 'utf8');
  console.log('patch-sherpa: android patched');
}

// ── iOS ──────────────────────────────────────────────────────────────────────

function patchIosViewModel() {
  const target = path.join(PKG, 'ios/ViewModel.swift');
  if (!fs.existsSync(target)) { console.log('patch-sherpa: ios ViewModel not found, skipping'); return; }

  let src = fs.readFileSync(target, 'utf8');
  if (src.includes('lexiconPath')) { console.log('patch-sherpa: ios ViewModel already patched'); return; }

  // Add optional fields to ModelPaths struct
  src = src.replace(
    /struct ModelPaths: Codable \{\s*\n\s*let modelPath: String\s*\n\s*let tokensPath: String\s*\n\s*let dataDirPath: String\s*\n\s*\}/,
    `struct ModelPaths: Codable {
    let modelPath: String
    let tokensPath: String
    let dataDirPath: String?
    let lexiconPath: String?
    let dictDirPath: String?
    let speakerId: Int?
}`,
  );

  // Update vitsConfig to use lexicon and dictDir
  src = src.replace(
    /let vitsConfig = sherpaOnnxOfflineTtsVitsModelConfig\(\s*model: paths\.modelPath,\s*lexicon: "",[\s\S]*?dataDir: paths\.dataDirPath\s*\)/,
    `let vitsConfig = sherpaOnnxOfflineTtsVitsModelConfig(
        model: paths.modelPath,
        lexicon: paths.lexiconPath ?? "",
        tokens: paths.tokensPath,
        dataDir: paths.dataDirPath ?? "",
        dictDir: paths.dictDirPath ?? ""
    )`,
  );

  // Make createOfflineTts return speakerId alongside the wrapper
  src = src.replace(
    /func createOfflineTts\(modelId: String\) -> SherpaOnnxOfflineTtsWrapper\?/,
    'func createOfflineTts(modelId: String) -> (wrapper: SherpaOnnxOfflineTtsWrapper, speakerId: Int)?',
  );
  src = src.replace(
    /return SherpaOnnxOfflineTtsWrapper\(config: &config\)/,
    'return (wrapper: SherpaOnnxOfflineTtsWrapper(config: &config), speakerId: paths.speakerId ?? 0)',
  );

  fs.writeFileSync(target, src, 'utf8');
  console.log('patch-sherpa: ios ViewModel patched');
}

function patchIosTTSManager() {
  const target = path.join(PKG, 'ios/SherpaOnnxOfflineTts.swift');
  if (!fs.existsSync(target)) { console.log('patch-sherpa: ios TTSManager not found, skipping'); return; }

  let src = fs.readFileSync(target, 'utf8');
  if (src.includes('currentSpeakerId')) { console.log('patch-sherpa: ios TTSManager already patched'); return; }

  // Add currentSpeakerId instance variable
  src = src.replace(
    /private var tts: SherpaOnnxOfflineTtsWrapper\?/,
    `private var tts: SherpaOnnxOfflineTtsWrapper?
    private var currentSpeakerId: Int = 0`,
  );

  // Update initializeTTS to parse speakerId from createOfflineTts result
  src = src.replace(
    /self\.tts = createOfflineTts\(modelId: modelId\)/,
    `if let result = createOfflineTts(modelId: modelId) {
            self.tts = result.wrapper
            self.currentSpeakerId = result.speakerId
        }`,
  );

  // Update generateAndSave to use currentSpeakerId
  src = src.replace(
    /let audio = tts\.generate\(text: processed, sid: 0, speed: 1\.0\)/,
    'let audio = tts.generate(text: processed, sid: self.currentSpeakerId, speed: 1.0)',
  );

  fs.writeFileSync(target, src, 'utf8');
  console.log('patch-sherpa: ios TTSManager patched');
}

// ── Run all ──────────────────────────────────────────────────────────────────

patchAndroid();
patchIosViewModel();
patchIosTTSManager();
