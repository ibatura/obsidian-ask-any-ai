import { Setting, TextComponent } from "obsidian";

export interface SecretSettingOptions {
  name: string;
  desc: string;
  placeholder: string;
  getValue: () => string;
  setValue: (value: string) => void | Promise<void>;
}

/**
 * Render a Setting whose text input holds a secret (API key / token).
 * The value is masked by default; an eye button toggles visibility so the
 * user can verify a pasted key. The trimmed value is passed to setValue.
 */
export function addSecretSetting(
  container: HTMLElement,
  opts: SecretSettingOptions
): Setting {
  const setting = new Setting(container).setName(opts.name).setDesc(opts.desc);
  let revealed = false;
  let textComp: TextComponent | null = null;

  setting.addText(text => {
    textComp = text;
    text
      .setPlaceholder(opts.placeholder)
      .setValue(opts.getValue())
      .onChange(async value => {
        await opts.setValue(value.trim());
      });
    text.inputEl.type = "password";
    text.inputEl.autocapitalize = "off";
    text.inputEl.setAttr("autocomplete", "off");
    text.inputEl.setAttr("spellcheck", "false");
  });

  setting.addExtraButton(btn => {
    btn
      .setIcon("eye")
      .setTooltip("Show")
      .onClick(() => {
        revealed = !revealed;
        if (textComp) textComp.inputEl.type = revealed ? "text" : "password";
        btn.setIcon(revealed ? "eye-off" : "eye").setTooltip(revealed ? "Hide" : "Show");
      });
  });

  return setting;
}
