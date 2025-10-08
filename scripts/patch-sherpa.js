// Patches react-native-sherpa-onnx-offline-tts to make initializeTTS async
// (adds Promise param so it runs on a background thread instead of blocking the JS bridge)
const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '../node_modules/react-native-sherpa-onnx-offline-tts/android/src/main/java/com/sherpaonnxofflinetts/TTSManagerModule.kt',
);

if (!fs.existsSync(target)) {
  console.log('patch-sherpa: target not found, skipping');
  process.exit(0);
}

let src = fs.readFileSync(target, 'utf8');

// Already patched
if (src.includes('fun initializeTTS(sampleRate: Double, channels: Int, modelId: String, promise: Promise)')) {
  console.log('patch-sherpa: already patched');
  process.exit(0);
}

src = src.replace(
  /\/\/ Initialize TTS and Audio Player\s*\n\s*@ReactMethod\s*\n\s*fun initializeTTS\(sampleRate: Double, channels: Int, modelId: String\) \{[\s\S]*?realTimeAudioPlayer\?\.start\(\)\s*\n\s*\}/,
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
                val dataDirPath = jsonObject.getString("dataDirPath")

                val config = OfflineTtsConfig(
                    model = OfflineTtsModelConfig(
                        vits = OfflineTtsVitsModelConfig(
                            model = modelPath,
                            tokens = tokensPath,
                            dataDir = dataDirPath,
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

fs.writeFileSync(target, src, 'utf8');
console.log('patch-sherpa: patched initializeTTS to be async');
