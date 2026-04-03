import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('Simple Code Scanner extension is now active');

	const disposable = vscode.commands.registerCommand('noob-scan.scan', () => {
		
		//sets variable editor to current open file
		const editor = vscode.window.activeTextEditor;

		//if nothing is in there it complains
		if (!editor) {
			vscode.window.showInformationMessage('No active file open');
			return;
		}

		//vars to get file name
		const document = editor.document;
		const fileName = document.fileName;

		//printing file name
		vscode.window.showInformationMessage(`Current file: ${fileName}`);
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}