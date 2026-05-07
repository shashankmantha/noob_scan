import * as vscode from 'vscode';

interface ScanResult {
	fileName: string;
	lineCount: number;
	todoCount: number;
	todoLines: number[];
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Simple Code Scanner extension is now active');
	const output = vscode.window.createOutputChannel('Simple Code Scanner');

	const scanCurrentFileCommand = vscode.commands.registerCommand('noob-scan.scan', async () => {
		const document = getActiveDocument();

		if (!document) {
			output.show(true);
			output.appendLine('No active file open');
			return;
		}

		const result = scanDocument(document);

		output.clear();
		output.show(true);
		output.appendLine('--- Simple Code Scanner ---');
		output.appendLine(`${result.fileName}: ${result.lineCount} lines, ${result.todoCount} TODOs`);
		output.appendLine('--------------------------------');
	});

	const scanWorkspaceCommand = vscode.commands.registerCommand('noob-scan.scanWorkspace', async () => {
		const documents = await getWorkspaceDocuments();

		if (documents.length === 0) {
			output.show(true);
			output.appendLine('No files found in workspace');
			return;
		}

		const results = documents.map(scanDocument);

		const totalFiles = results.length;
		const totalLines = results.reduce((sum, result) => sum + result.lineCount, 0);
		const totalTodos = results.reduce((sum, result) => sum + result.todoCount, 0);

		output.clear();
		output.show(true);

		output.appendLine('--- Simple Code Scanner ---');

		results.forEach(result => {
			if (result.todoCount === 0) {

				output.appendLine(`${result.fileName}: no TODOs`);

			} else {

				output.appendLine(

					`${result.fileName}: TODO at lines ${result.todoLines.join(', ')}`
					
				);
			}
});

output.appendLine('--------------------------------');

output.appendLine(
	`TOTAL: ${totalFiles} files, ${totalLines} lines, ${totalTodos} TODOs`
);
	});

	context.subscriptions.push(scanCurrentFileCommand, scanWorkspaceCommand);
}

export function deactivate() {}

function getActiveDocument(): vscode.TextDocument | undefined {
	const editor = vscode.window.activeTextEditor;
	return editor?.document;
}

async function getWorkspaceDocuments(): Promise<vscode.TextDocument[]> {
	const workspaceFolders = vscode.workspace.workspaceFolders;

	if (!workspaceFolders || workspaceFolders.length === 0) {
		vscode.window.showInformationMessage('No workspace folder is open');
		return [];
	}

	const includePattern = '**/*.{ts,js,tsx,jsx,kt,java,py,c,cpp,h,hpp}';
	const excludePattern = '**/{node_modules,dist,out,build,.git,.gradle,.idea,.vscode}/**';

	const files = await vscode.workspace.findFiles(includePattern, excludePattern);

	const documents: vscode.TextDocument[] = [];

	for (const file of files) {
		try {
			const document = await vscode.workspace.openTextDocument(file);
			documents.push(document);
		} catch (error) {
			console.error(`Failed to open file: ${file.fsPath}`, error);
		}
	}

	return documents;
}

function scanDocument(document: vscode.TextDocument): ScanResult {
	const text = document.getText();
	const fileName = document.fileName.split('/').pop() ?? document.fileName;
	const lineCount = document.lineCount;

	let todoLines: number[] = [];
	const lines = text.split('\n');

	lines.forEach((line, index) => {
		if (line.includes('TODO')) {
		todoLines.push(index + 1);
		}
    });

	return {
	fileName,
	lineCount,
	todoCount: todoLines.length,
	todoLines
  };
}	