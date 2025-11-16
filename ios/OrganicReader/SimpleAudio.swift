import Foundation
import AVFoundation

@objc(SimpleAudio)
class SimpleAudio: RCTEventEmitter {

  private var player: AVAudioPlayer?
  private var nextPlayer: AVAudioPlayer?
  private var rate: Float = 1.0
  private var progressTimer: Timer?
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

  private func makePlayer(_ filePath: String) throws -> AVAudioPlayer {
    let url = filePath.hasPrefix("/") ? URL(fileURLWithPath: filePath) : URL(fileURLWithPath: filePath.replacingOccurrences(of: "file://", with: ""))
    let p = try AVAudioPlayer(contentsOf: url)
    p.enableRate = true
    p.rate = self.rate
    p.delegate = self
    p.prepareToPlay()
    return p
  }

  @objc(play:resolver:rejecter:)
  func play(_ filePath: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    queue.async {
      do {
        self.ensureSession()
        self.stopProgressTimer()
        self.player?.stop()
        self.nextPlayer?.stop()
        self.nextPlayer = nil

        let p = try self.makePlayer(filePath)
        p.play()
        self.player = p

        self.startProgressTimer()
        resolve(nil)
      } catch {
        reject("AUDIO_ERROR", error.localizedDescription, error)
      }
    }
  }

  @objc(queueNext:resolver:rejecter:)
  func queueNext(_ filePath: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    queue.async {
      do {
        self.nextPlayer?.stop()
        self.nextPlayer = try self.makePlayer(filePath)
        resolve(nil)
      } catch {
        reject("AUDIO_ERROR", error.localizedDescription, error)
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

  private func startProgressTimer() {
    stopProgressTimer()
    DispatchQueue.main.async {
      self.progressTimer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
        guard let self = self, let p = self.player, p.isPlaying else { return }
        self.sendEvent(withName: "AudioProgress", body: ["position": p.currentTime * 1000])
      }
    }
  }

  private func stopProgressTimer() {
    DispatchQueue.main.async {
      self.progressTimer?.invalidate()
      self.progressTimer = nil
    }
  }
}

extension SimpleAudio: AVAudioPlayerDelegate {
  func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
    if let np = self.nextPlayer {
      // Gapless transition: start pre-loaded next player immediately
      np.play()
      self.player = np
      self.nextPlayer = nil
      self.startProgressTimer()
      // Notify JS so it can queue the one after
      sendEvent(withName: "AudioPlaybackComplete", body: nil)
    } else {
      stopProgressTimer()
      sendEvent(withName: "AudioPlaybackComplete", body: nil)
    }
  }

  func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
    stopProgressTimer()
    sendEvent(withName: "AudioPlaybackError", body: ["error": error?.localizedDescription ?? "decode error"])
  }
}
