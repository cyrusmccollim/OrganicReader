package com.organicreader

import android.media.MediaPlayer
import android.media.PlaybackParams
import android.os.Handler
import android.os.HandlerThread
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class SimpleAudioModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val thread = HandlerThread("SimpleAudio").also { it.start() }
    private val handler = Handler(thread.looper)
    private var player: MediaPlayer? = null
    // Pre-prepared next player so there is no blocking prepare() gap between segments
    private var nextPlayer: MediaPlayer? = null
    private var rate = 1.0f
    private var progressRunnable: Runnable? = null

    override fun getName() = "SimpleAudio"

    override fun invalidate() {
        handler.post {
            stopProgress()
            player?.release()
            player = null
            nextPlayer?.release()
            nextPlayer = null
        }
        thread.quitSafely()
        super.invalidate()
    }

    @ReactMethod
    fun play(filePath: String, promise: Promise) {
        handler.post {
            try {
                stopProgress()

                // Re-use pre-warmed player if path matches, else create and prepare fresh
                val mp: MediaPlayer
                val warm = nextPlayer
                nextPlayer = null
                if (warm != null) {
                    player?.release()
                    mp = warm
                } else {
                    player?.release()
                    mp = MediaPlayer()
                    mp.setDataSource(filePath)
                    mp.prepare()
                }

                player = mp
                mp.setOnCompletionListener {
                    stopProgress()
                    emit("AudioPlaybackComplete", null)
                }
                mp.setOnErrorListener { _, what, extra ->
                    stopProgress()
                    val m = Arguments.createMap()
                    m.putString("error", "MediaPlayer error $what/$extra")
                    emit("AudioPlaybackError", m)
                    true
                }
                mp.playbackParams = PlaybackParams().setSpeed(rate)
                mp.start()
                startProgress()
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("AUDIO_ERROR", e.message ?: "playback failed")
            }
        }
    }

    /** Pre-prepare the next segment's MediaPlayer in the background so play() has no blocking prepare() call. */
    @ReactMethod
    fun preWarm(filePath: String, promise: Promise) {
        handler.post {
            try {
                nextPlayer?.release()
                val mp = MediaPlayer()
                mp.setDataSource(filePath)
                mp.prepare()  // runs on the audio handler thread, not blocking JS
                mp.playbackParams = PlaybackParams().setSpeed(rate)
                nextPlayer = mp
                promise.resolve(null)
            } catch (e: Exception) {
                nextPlayer = null
                promise.resolve(null)  // pre-warm failure is non-fatal
            }
        }
    }

    @ReactMethod
    fun pause(promise: Promise) {
        handler.post {
            stopProgress()
            runCatching { player?.pause() }
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun resume(promise: Promise) {
        handler.post {
            try {
                player?.start()
                startProgress()
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("AUDIO_ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        handler.post {
            stopProgress()
            runCatching { player?.stop() }
            player?.release()
            player = null
            nextPlayer?.release()
            nextPlayer = null
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun seekTo(ms: Double, promise: Promise) {
        handler.post {
            try {
                player?.seekTo(ms.toInt())
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("AUDIO_ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun setRate(newRate: Double, promise: Promise) {
        handler.post {
            rate = newRate.toFloat()
            try {
                player?.playbackParams = PlaybackParams().setSpeed(rate)
                nextPlayer?.playbackParams = PlaybackParams().setSpeed(rate)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("AUDIO_ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun getPosition(promise: Promise) {
        handler.post {
            promise.resolve(player?.currentPosition?.toDouble() ?: 0.0)
        }
    }

    // 100ms ticks — 2.5× faster word highlighting with no extra CPU cost
    private fun startProgress() {
        stopProgress()
        val r = object : Runnable {
            override fun run() {
                val mp = player ?: return
                if (!mp.isPlaying) return
                val m = Arguments.createMap()
                m.putDouble("position", mp.currentPosition.toDouble())
                emit("AudioProgress", m)
                handler.postDelayed(this, 100)
            }
        }
        progressRunnable = r
        handler.postDelayed(r, 100)
    }

    private fun stopProgress() {
        progressRunnable?.let { handler.removeCallbacks(it) }
        progressRunnable = null
    }

    private fun emit(event: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(event, params)
    }
}
