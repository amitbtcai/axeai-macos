import AVFAudio
import Foundation
import Speech

private struct TranscriptionOutput: Encodable {
  let text: String?
  let error: String?
}

private enum HelperError: LocalizedError {
  case invalidArguments
  case unavailable
  case unsupportedLocale(String)
  case emptyTranscript

  var errorDescription: String? {
    switch self {
    case .invalidArguments:
      return "The speech helper received invalid arguments."
    case .unavailable:
      return "Apple on-device speech transcription is unavailable on this Mac."
    case .unsupportedLocale(let locale):
      return "Apple on-device speech transcription does not support locale \(locale)."
    case .emptyTranscript:
      return "Apple on-device speech transcription returned no text."
    }
  }
}

private struct Arguments {
  let inputURL: URL
  let localeIdentifier: String
  let context: String?

  init(commandLine: [String]) throws {
    var inputPath: String?
    var localeIdentifier = Locale.current.identifier
    var context: String?
    var index = 1

    while index < commandLine.count {
      let flag = commandLine[index]
      guard index + 1 < commandLine.count else {
        throw HelperError.invalidArguments
      }
      let value = commandLine[index + 1]
      switch flag {
      case "--input":
        inputPath = value
      case "--locale":
        localeIdentifier = value
      case "--context":
        context = value
      default:
        throw HelperError.invalidArguments
      }
      index += 2
    }

    guard let inputPath, !inputPath.isEmpty else {
      throw HelperError.invalidArguments
    }
    self.inputURL = URL(fileURLWithPath: inputPath)
    self.localeIdentifier = localeIdentifier
    self.context = context
  }
}

@available(macOS 26.0, *)
private func transcribe(_ arguments: Arguments) async throws -> String {
  guard SpeechTranscriber.isAvailable else {
    throw HelperError.unavailable
  }

  let requestedLocale = Locale(identifier: arguments.localeIdentifier)
  guard
    let supportedLocale = await SpeechTranscriber.supportedLocale(
      equivalentTo: requestedLocale
    )
  else {
    throw HelperError.unsupportedLocale(arguments.localeIdentifier)
  }

  let transcriber = SpeechTranscriber(
    locale: supportedLocale,
    preset: .transcription
  )
  if let installation = try await AssetInventory.assetInstallationRequest(
    supporting: [transcriber]
  ) {
    try await installation.downloadAndInstall()
  }

  let analysisContext = AnalysisContext()
  if let context = arguments.context?.trimmingCharacters(in: .whitespacesAndNewlines),
    !context.isEmpty
  {
    analysisContext.contextualStrings[.general] = [context]
  }

  let audioFile = try AVAudioFile(forReading: arguments.inputURL)
  let analyzer = SpeechAnalyzer(modules: [transcriber])
  try await analyzer.setContext(analysisContext)
  let resultsTask = Task<String, Error> {
    var segments: [String] = []
    for try await result in transcriber.results {
      let text = String(result.text.characters)
        .trimmingCharacters(in: .whitespacesAndNewlines)
      if !text.isEmpty {
        segments.append(text)
      }
    }
    return segments.joined(separator: " ")
  }

  do {
    let finalTime = try await analyzer.analyzeSequence(from: audioFile)
    if let finalTime {
      try await analyzer.finalizeAndFinish(through: finalTime)
    } else {
      try await analyzer.finalizeAndFinishThroughEndOfInput()
    }
    let transcript = try await resultsTask.value
      .trimmingCharacters(in: .whitespacesAndNewlines)
    guard !transcript.isEmpty else {
      throw HelperError.emptyTranscript
    }
    return transcript
  } catch {
    await analyzer.cancelAndFinishNow()
    resultsTask.cancel()
    throw error
  }
}

private func writeOutput(_ output: TranscriptionOutput) {
  let encoder = JSONEncoder()
  guard let data = try? encoder.encode(output) else {
    FileHandle.standardOutput.write(Data("{\"error\":\"Speech helper output failed.\"}\n".utf8))
    return
  }
  FileHandle.standardOutput.write(data)
  FileHandle.standardOutput.write(Data("\n".utf8))
}

@main
private struct AxeAIAppleSpeech {
  static func main() async {
    do {
      let arguments = try Arguments(commandLine: CommandLine.arguments)
      guard #available(macOS 26.0, *) else {
        throw HelperError.unavailable
      }
      let text = try await transcribe(arguments)
      writeOutput(TranscriptionOutput(text: text, error: nil))
    } catch {
      writeOutput(
        TranscriptionOutput(
          text: nil,
          error: (error as? LocalizedError)?.errorDescription
            ?? error.localizedDescription
        )
      )
      Foundation.exit(EXIT_FAILURE)
    }
  }
}
