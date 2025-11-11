const { Plugin, Notice, MarkdownView } = require("obsidian");
const { exec } = require("child_process");

const CLAUDE_PATH = `"C:\\Users\\admin\\AppData\\Roaming\\npm\\claude.cmd"`;
const MODEL_NAME = "claude-sonnet-4-5-20250929";

module.exports = class ProofreadPlugin extends Plugin {
	async onload() {
		console.log("Claude Code校正プラグイン（非同期対応）読み込み完了");
		this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.addProofButton()));
		this.addProofButton();
	}

	addProofButton() {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;
		const toolbar = view.containerEl.querySelector(".view-header");
		if (!toolbar) return;

		// 重複防止
		const oldBtn = toolbar.querySelector(".proofread-button");
		if (oldBtn) oldBtn.remove();

		const btn = document.createElement("button");
		btn.className = "proofread-button";
		btn.textContent = "校正";
		Object.assign(btn.style, {
			marginLeft: "8px",
			background: "var(--interactive-accent)",
			color: "white",
			border: "none",
			borderRadius: "4px",
			padding: "4px 8px",
			cursor: "pointer",
			transition: "opacity 0.3s ease"
		});

		btn.addEventListener("click", async () => {
			const editor = view.editor;
			if (!editor) return new Notice("エディタが見つかりません");

			const text = editor.getValue();
			const fileName = view.file?.name || "未保存ノート";

			// 🔹 UI即更新
			btn.disabled = true;
			btn.style.opacity = "0.6";
			const originalText = btn.textContent;
			btn.textContent = "校正中…";
			new Notice("Claude Codeで校正中...");

			try {
				const result = await this.runClaudeProofread(fileName, text);
				editor.setValue(result);
				new Notice("校正完了！");
			} catch (err) {
				console.error(err);
				new Notice("エラー: " + (err?.message || String(err)));
			} finally {
				btn.disabled = false;
				btn.style.opacity = "1";
				btn.textContent = originalText;
			}
		});

		toolbar.appendChild(btn);
	}

	async runClaudeProofread(fileName, text) {
		const prompt = `
対象テキストは、音声入力で作成された台本です。以下のルールに従って校正してください。
結果以外の文章は出力しないでください。対象テキストの校正結果のみを出力してください。
## 修正の方針

### 1. 誤字脱字の修正
音声入力特有の誤変換を修正してください。

例：
- 「プログラミングの基礎をご照会します」→「プログラミングの基礎をご紹介します」
- 「このツールを仕様して開発を進めます」→「このツールを使用して開発を進めます」
- 「データベースにアクセス強方法を説明します」→「データベースにアクセスする方法を説明します」
- 「機能をカスタマイズで切ます」→「機能をカスタマイズできます」

### 2. 口語的過ぎる言い回しを書き言葉に
話し言葉特有の冗長な表現や、「〜なんか」「〜とか」「〜みたいな」などのカジュアル表現を、  
自然な書き言葉に直してください。  
ただし、**リズムや文体を極力維持し、ニュアンスを壊さないように**してください。

例：
- 「なんかその、すごく大事な話なんですけど」→「とても大事な話ですが」  
- 「このへんが、まあ、ポイントかなと思います」→「このあたりがポイントだと思います」  
- 「〜していく感じになります」→「〜していきます」  
- 「〜とか〜とかができるようになります」→「〜や〜ができるようになります」  

### 3. 文の意味や語調を変えない
- 表現を整えても、**話し手の意図・トーン・感情は維持**してください。  
- 文体（です／ます調 or である調）は統一せず、**原文のスタイルを尊重**してください。  
- 不必要な言い換え・意訳・要約は行わないでください。  

例：
- ❌ 「少し難しいですが頑張っていきましょう」→「努力が必要です」  
　→ 意味が変わってしまうため修正しない。  
- ✅ 「少し難しいですが頑張っていきましょう」→「少し難しいですが、頑張っていきましょう」  
　→ 読点や自然な助詞の補完はOK。

### 4. 文法・句読点・助詞の微修正
- 「てにをは」など助詞の誤用を自然に直す  
- 不足している読点（、）を補う  
- 不要な重複表現を取り除く  

例：
- 「私が行ったところが、行った場所が、とても綺麗でした」→「私が行った場所はとても綺麗でした」  
- 「この仕組みは理解しやすい仕組みです」→「この仕組みは理解しやすいです」  

### 5. 修正は最小限に
- **「人が軽く校正した程度」にとどめる**。  
- 大幅な言い換え・構成変更・要約は禁止。  
- 一文の構造を変えず、誤字・助詞・語尾・言い回しのみを調整。  

### 6. 出力ルール
- 出力は**校正後の本文のみ**。  
- 校正説明・メタコメント・「修正しました」などは出力しない。  
- 空行・段落構成は原文を維持。

---
対象テキスト：
${text}
`.trim();

		const cmd = `${CLAUDE_PATH} --model ${MODEL_NAME}`;
		return new Promise((resolve, reject) => {
			const child = exec(cmd, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
				if (error) return reject(new Error("Claude Code 実行エラー: " + stderr || error.message));
				resolve(stdout.trim());
			});
			child.stdin.write(prompt);
			child.stdin.end();
		});
	}
};
