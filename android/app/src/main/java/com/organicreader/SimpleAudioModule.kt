package com.organicreader

import android.media.AudioAttributes
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
    private var rate = 1.0f
    private var progressRunnable: Runnable? = null

    override fun getName() = "SimpleAudio"

    override fun invalidate() {
        handler.post {
            stopProgress()
            player?.release()
            player = null
        }
        thread.quitSafely()
        super.invalidate()
    }

    @ReactMethod
    fun play(filePath: String, promise: Promise) {
        handler.post {
            try {
                stopProgress()
                runCatching { player?.stop() }
                player?.release()
                player = null

                val mp = MediaPlayer()
                mp.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                mp.setDataSource(filePath)
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
                mp.prepare()
                mp.playbackParams = PlaybackParams()
                    .setSpeed(rate)
                    .setAudioStretchMode(PlaybackParams.AUDIO_STRETCH_MODE_VOICE)
                mp.start()
                player = mp
                startProgress()
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("AUDIO_ERROR", e.message ?: "playback failed")
            }
        }
    }

    // No-op stub kept so the JS SimpleAudio.preWarm call doesn't crash
    @ReactMethod
    fun preWarm(filePath: String, promise: Promise) {
        promise.resolve(null)
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
                player?.playbackParams = PlaybackParams()
                    .setSpeed(rate)
                    .setAudioStretchMode(PlaybackParams.AUDIO_STRETCH_MODE_VOICE)
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
