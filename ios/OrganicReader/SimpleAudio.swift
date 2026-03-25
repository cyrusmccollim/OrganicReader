import Foundation
import AVFoundation

@objc(SimpleAudio)
class SimpleAudio: RCTEventEmitter {

  // Current player and a pre-warmed next player for gapless handoff
  private var player: AVAudioPlayer?
  private var nextPlayer: AVAudioPlayer?
  private var rate: Float = 1.0
  // Progress timer runs on the audio queue — no main-thread contention with UI
  private var progressTimer: DispatchSourceTimer?
  private var sessionActive = false
  private let queue = DispatchQueue(label: "SimpleAudio", qos: .userInitiated)

  override static func requiresMainQueueSetup() -> Bool { return false }

  override func supportedEvents() -> [String] {
    return ["AudioPlaybackComplete", "AudioPlaybackError", "AudioProgress"]
  }

  private func ensureSession() {
    if sessionActive { return }
    try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
    try? AVAudioSession.sharedInstance().setActive(true)
    sessionActive = true
  }

  @objc(play:resolver:rejecter:)
  func play(_ filePath: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    queue.async {
      do {
        self.ensureSession()

        let url = filePath.hasPrefix("/")
          ? URL(fileURLWithPath: filePath)
          : URL(fileURLWithPath: filePath.replacingOccurrences(of: "file://", with: ""))

        self.stopProgressTimer()

        // Re-use pre-warmed player if it matches this path, otherwise create fresh
        let p: AVAudioPlayer
        if let warm = self.nextPlayer, warm.url == url {
          p = warm
          self.nextPlayer = nil
        } else {
          self.player?.stop()
          p = try AVAudioPlayer(contentsOf: url)
          p.enableRate = true
          p.prepareToPlay()
        }

        p.rate = self.rate
        p.delegate = self
        p.play()
        self.player = p

        self.startProgressTimer()
        resolve(nil)
      } catch {
        reject("AUDIO_ERROR", error.localizedDescription, error)
      }
    }
  }

  /// Pre-warm the next segment's player so play() has zero decode latency.
  @objc(preWarm:resolver:rejecter:)
  func preWarm(_ filePath: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    queue.async {
      do {
        let url = filePath.hasPrefix("/")
          ? URL(fileURLWithPath: filePath)
          : URL(fileURLWithPath: filePath.replacingOccurrences(of: "file://", with: ""))
        let p = try AVAudioPlayer(contentsOf: url)
        p.enableRate = true
        p.rate = self.rate
        p.prepareToPlay()  // loads buffers + acquires hardware in background
        self.nextPlayer = p
        resolve(nil)
      } catch {
        // Pre-warm failure is non-fatal — play() will create fresh player
        resolve(nil)
      }
    }
  }

  @objc(pause:rejecter:)
  func pause(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    queue.async {
      self.stopProgressTimer()
      self.player?.pause()
      resolve(nil)
    }
  }

  @objc(resume:rejecter:)
  func resume(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    queue.async {
      self.player?.play()
      self.startProgressTimer()
      resolve(nil)
    }
  }

  @objc(stop:rejecter:)
  func stop(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    queue.async {
      self.stopProgressTimer()
      self.player?.stop()
      self.player = nil
      self.nextPlayer?.stop()
      self.nextPlayer = nil
      resolve(nil)
    }
  }

  @objc(seekTo:resolver:rejecter:)
  func seekTo(_ ms: Double, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    queue.async {
      self.player?.currentTime = ms / 1000.0
      resolve(nil)
    }
  }

  @objc(setRate:resolver:rejecter:)
  func setRate(_ newRate: Double, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    queue.async {
      self.rate = Float(newRate)
      self.player?.rate = self.rate
      self.nextPlayer?.rate = self.rate
      resolve(nil)
    }
  }

  @objc(getPosition:rejecter:)
  func getPosition(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    queue.async {
      let ms = (self.player?.currentTime ?? 0) * 1000
      resolve(ms)
    }
  }

  // 100ms ticks on the audio queue — faster highlighting, no main-thread pressure
  private func startProgressTimer() {
    stopProgressTimer()
    let t = DispatchSource.makeTimerSource(queue: queue)
    t.schedule(deadline: .now() + .milliseconds(100), repeating: .milliseconds(100))
    t.setEventHandler { [weak self] in
      guard let self = self, let p = self.player, p.isPlaying else { return }
      self.sendEvent(withName: "AudioProgress", body: ["position": p.currentTime * 1000])
    }
    t.resume()
    progressTimer = t
  }

  private func stopProgressTimer() {
    progressTimer?.cancel()
    progressTimer = nil
  }
}

extension SimpleAudio: AVAudioPlayerDelegate {
  func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
    queue.async {
      self.stopProgressTimer()
      self.sendEvent(withName: "AudioPlaybackComplete", body: nil)
    }
  }

  func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
    queue.async {
      self.stopProgressTimer()
      self.sendEvent(withName: "AudioPlaybackError", body: ["error": error?.localizedDescription ?? "decode error"])
    }
  }
}
