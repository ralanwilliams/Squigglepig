import ExpoModulesCore
import UIKit

// The endless hunt's padlock on an iPhone (src/lib/screenPin.ts). An app can't
// pin itself here: Guided Access is the person's own (Settings › Accessibility
// › Guided Access, started with a triple-click of the side button). So pin and
// unpin do nothing, and isPinned says whether Guided Access is on, so the game
// can suggest it.
public class ScreenPinModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ScreenPin")

    Function("pin") {}

    Function("unpin") {}

    AsyncFunction("isPinned") { () -> Bool in
      return UIAccessibility.isGuidedAccessEnabled
    }.runOnQueue(.main)
  }
}
