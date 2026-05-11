import * as vscode from 'vscode';

interface ScanResult {
	fileName: string;
	lineCount: number;
	todoCount: number;
	todoLines: number[];
}

type ScannerAction = 'scanCurrentFile' | 'scanWorkspace' | 'clearOutput';

export function activate(context: vscode.ExtensionContext) {
	console.log('Simple Code Scanner extension is now active');

	const output = vscode.window.createOutputChannel('Simple Code Scanner');

	const diagnostics = vscode.languages.createDiagnosticCollection('simple-code-scanner');

	const scanCurrentFileCommand = vscode.commands.registerCommand('noob-scan.scan', async () => {

		const document = getActiveDocument();
		

		if (!document) {
			output.show(true);
			output.appendLine('No active file open');
			return;
		}

		const result = scanDocument(document);

		publishDiagnostics(document, result, diagnostics);

		output.clear();
		output.show(true);
		output.appendLine('--- Simple Code Scanner ---');

		if (result.todoCount === 0) {
			output.appendLine(`${result.fileName}: no TODOs`);
		} else {
			output.appendLine(`${result.fileName}: TODO at lines ${result.todoLines.join(', ')}`);
		}

		output.appendLine('--------------------------------');
		output.appendLine(`TOTAL: 1 file, ${result.lineCount} lines, ${result.todoCount} TODOs`);

	});

	const scanWorkspaceCommand = vscode.commands.registerCommand('noob-scan.scanWorkspace', async () => {

		const documents = await getWorkspaceDocuments();

		if (documents.length === 0) {
			output.show(true);
			output.appendLine('No files found in workspace');
			return;
		}

		const results = documents.map(document => {	
			const result = scanDocument(document);
			publishDiagnostics(document, result, diagnostics);
			return result;
		});

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

				output.appendLine(`${result.fileName}: TODO at lines ${result.todoLines.join(', ')}`);

			}

		});

		output.appendLine('--------------------------------');
		output.appendLine(`TOTAL: ${totalFiles} files, ${totalLines} lines, ${totalTodos} TODOs`);
	});

	const openScannerCommand = vscode.commands.registerCommand('noob-scan.openScanner', async () => {

		const choice = await vscode.window.showQuickPick<{
			label: string;
			description: string;
			action: ScannerAction;
		}>(
			[
				{
					label: '$(file-code) Scan Current File',
					description: 'Scan the currently open file',
					action: 'scanCurrentFile',
				},
				{
					label: '$(folder) Scan Workspace',
					description: 'Scan files in the current workspace folder',
					action: 'scanWorkspace',
				},
				{
					label: '$(trash) Clear Output',
					description: 'Clear the Simple Code Scanner output panel',
					action: 'clearOutput',
				},
			],
			{
				placeHolder: 'Choose a Simple Code Scanner action',
			}
		);

		if (!choice) {
			return;
		}

		if (choice.action === 'scanCurrentFile') {
			await vscode.commands.executeCommand('noob-scan.scan');
			return;5
		}

		if (choice.action === 'scanWorkspace') {
			await vscode.commands.executeCommand('noob-scan.scanWorkspace');
			return;
		}

		if (choice.action === 'clearOutput') {
			output.clear();
			diagnostics.clear();
			output.show(true);
			output.appendLine('Simple Code Scanner output and diagnostics cleared.');
		}
	});


	context.subscriptions.push(
	scanCurrentFileCommand,
	scanWorkspaceCommand,
	openScannerCommand,
	diagnostics,
	output
	);
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

	const includePattern = '**/*';
	const excludePattern = '**/{node_modules,dist,out,build,.git,.gradle,.idea,.vscode,bin,obj,target}/**';

	const files = await vscode.workspace.findFiles(includePattern, excludePattern);

	const documents: vscode.TextDocument[] = [];

	for (const file of files) {
		try {
			const document = await vscode.workspace.openTextDocument(file);

			if (document.getText().length > 200_000) {
				continue;
			}

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

	const todoLines: number[] = [];
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
		todoLines,
	};
}

function publishDiagnostics(
	document: vscode.TextDocument,
	result: ScanResult,
	diagnostics: vscode.DiagnosticCollection ): void {	

	const vscodeDiagnostics: vscode.Diagnostic[] = [];

	for (const lineNumber of result.todoLines) {

		const zeroBasedLine = lineNumber - 1;
		const lineText = document.lineAt(zeroBasedLine).text;
		const todoColumn = lineText.indexOf('TODO');

		if (todoColumn === -1) {
			continue;
		}

		const range = new vscode.Range(
			zeroBasedLine,
			todoColumn,
			zeroBasedLine,
			todoColumn + 'TODO'.length
		);

		const diagnostic = new vscode.Diagnostic(
			range,
			'TODO found',
			vscode.DiagnosticSeverity.Information
		);

		diagnostic.source = 'Simple Code Scanner';
		diagnostic.code = 'debug.todo';

		vscodeDiagnostics.push(diagnostic);

	}

	diagnostics.set(document.uri, vscodeDiagnostics);

	}