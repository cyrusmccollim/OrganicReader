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
                player?.release()
                nextPlayer?.release()
                nextPlayer = null
                val mp = MediaPlayer().also { player = it }
                mp.setDataSource(filePath)
                mp.setOnCompletionListener { onCurrentComplete() }
                mp.setOnErrorListener { _, what, extra ->
                    stopProgress()
                    val m = Arguments.createMap()
                    m.putString("error", "MediaPlayer error $what/$extra")
                    emit("AudioPlaybackError", m)
                    true
                }
                mp.prepare()
                mp.playbackParams = PlaybackParams().setSpeed(rate)
                mp.start()
                startProgress()
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("AUDIO_ERROR", e.message ?: "playback failed")
            }
        }
    }

    @ReactMethod
    fun queueNext(filePath: String, promise: Promise) {
        handler.post {
            try {
                nextPlayer?.release()
                val np = MediaPlayer()
                np.setDataSource(filePath)
                np.setOnCompletionListener { onCurrentComplete() }
                np.setOnErrorListener { _, what, extra ->
                    stopProgress()
                    val m = Arguments.createMap()
                    m.putString("error", "MediaPlayer error $what/$extra")
                    emit("AudioPlaybackError", m)
                    true
                }
                np.prepare()
                np.playbackParams = PlaybackParams().setSpeed(rate)
                nextPlayer = np
                // Android gapless handoff
                player?.setNextMediaPlayer(np)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("AUDIO_ERROR", e.message ?: "queue failed")
            }
        }
    }

    private fun onCurrentComplete() {
        val np = nextPlayer
        if (np != null) {
            // Gapless transition already happened via setNextMediaPlayer.
            // The old player is done — release it. np is now playing.
            player?.release()
            player = np
            nextPlayer = null
            startProgress()
            // Tell JS so it can queue the NEXT one after this
            emit("AudioPlaybackComplete", null)
        } else {
            stopProgress()
            emit("AudioPlaybackComplete", null)
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

    private fun startProgress() {
        stopProgress()
        val r = object : Runnable {
            override fun run() {
                val mp = player ?: return
                if (!mp.isPlaying) return
                val m = Arguments.createMap()
                m.putDouble("position", mp.currentPosition.toDouble())
                emit("AudioProgress", m)
                handler.postDelayed(this, 250)
            }
        }
        progressRunnable = r
        handler.postDelayed(r, 250)
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
