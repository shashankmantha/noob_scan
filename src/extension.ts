import * as vscode from 'vscode';

interface ScanResult {
	fileName: string;
	lineCount: number;
	todoCount: number;
	todoLines: number[];
	fixmeCount: number;
	fixmeLines: number[];
}

type ScannerAction = 'scanCurrentFile' | 'scanWorkspace' | 'openDashboard' | 'clearOutput';

interface DashboardState {
	lastScanMode: 'none' | 'currentFile' | 'workspace';
	targetLabel: string;
	workspaceLabel: string;
	activeFileLabel: string;
	totalFiles: number;
	totalLines: number;
	totalTodos: number;
	totalFixmes: number;
	results: ScanResult[];
}

function getWorkspaceLabel(): string {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		return 'No workspace';
	}
	return workspaceFolders.map(folder => folder.name).join(', ');
}

function getActiveFileLabel(): string {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return 'No file open';
	}
	return editor.document.fileName.split('/').pop() ?? editor.document.fileName;
}

function createEmptyDashboardState(): DashboardState {
	return {
		lastScanMode: 'none',
		targetLabel: 'Nothing scanned yet',
		workspaceLabel: getWorkspaceLabel(),
		activeFileLabel: getActiveFileLabel(),
		totalFiles: 0,
		totalLines: 0,
		totalTodos: 0,
		totalFixmes: 0,
		results: [],
	};
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function updateDashboard(panel: vscode.WebviewPanel | undefined, state: DashboardState): void {
	if (!panel) {
		return;
	}

	panel.webview.html = generateDashboardHtml(state);
}

function generateDashboardHtml(state: DashboardState): string {
	const resultsHtml = state.results
		.map(result => {
			const todoHtml =
				result.todoCount > 0
					? `<div class="finding todo">TODO at lines ${result.todoLines.join(', ')}</div>`
					: '';

			const fixmeHtml =
				result.fixmeCount > 0
					? `<div class="finding fixme">FIXME at lines ${result.fixmeLines.join(', ')}</div>`
					: '';

			const emptyHtml =
				result.todoCount === 0 && result.fixmeCount === 0
					? `<div class="muted">No TODOs or FIXMEs</div>`
					: '';

			return `<div class="result-item">
				<strong>${escapeHtml(result.fileName)}</strong>
				${todoHtml}
				${fixmeHtml}
				${emptyHtml}
			</div>`;
		})
		.join('');

	return `
		<!DOCTYPE html>
		<html>
		<head>
			<style>
				body {
					font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
					padding: 20px;
					background: var(--vscode-editor-background);
					color: var(--vscode-editor-foreground);
				}
				.header {
					margin-bottom: 20px;
				}
				.stats {
					display: grid;
					grid-template-columns: repeat(2, 1fr);
					gap: 10px;
					margin-bottom: 20px;
				}
				.stat-box {
					background: var(--vscode-editor-lineHighlightBackground);
					padding: 10px;
					border-radius: 4px;
					border-left: 3px solid var(--vscode-textLink-foreground);
				}
				.stat-label {
					font-size: 0.85em;
					opacity: 0.8;
				}
				.stat-value {
					font-size: 1.5em;
					font-weight: bold;
				}
				.buttons {
					display: flex;
					gap: 10px;
					margin-bottom: 20px;
					flex-wrap: wrap;
				}
				button {
					background: var(--vscode-button-background);
					color: var(--vscode-button-foreground);
					border: none;
					padding: 8px 16px;
					border-radius: 4px;
					cursor: pointer;
					font-family: inherit;
				}
				button:hover {
					background: var(--vscode-button-hoverBackground);
				}
				.results {
					margin-top: 20px;
				}
				.result-item {
					background: var(--vscode-editor-lineHighlightBackground);
					padding: 10px;
					margin-bottom: 8px;
					border-radius: 4px;
					border-left: 2px solid var(--vscode-notificationWarning-background);
				}
				.no-results {
					opacity: 0.6;
					font-style: italic;
				}
				.finding {
					margin-top: 6px;
					font-family: var(--vscode-editor-font-family);
				}
				.todo {
					color: var(--vscode-editorInfo-foreground);
				}
				.fixme {
					color: var(--vscode-editorWarning-foreground);
				}
				.muted {
					opacity: 0.7;
					margin-top: 6px;
				}
			</style>
		</head>
		<body>
			<div class="header">
				<h2>Simple Code Scanner Dashboard</h2>
				<p>Last scan: <strong>${state.lastScanMode === 'none' ? 'None' : escapeHtml(state.lastScanMode)}</strong></p>
				<p>Target: <strong>${escapeHtml(state.targetLabel)}</strong></p>
				<p>Workspace: <strong>${escapeHtml(state.workspaceLabel)}</strong></p>
				<p>Active file: <strong>${escapeHtml(state.activeFileLabel)}</strong></p>
			</div>

			<div class="stats">
				<div class="stat-box">
					<div class="stat-label">Files</div>
					<div class="stat-value">${state.totalFiles}</div>
				</div>
				<div class="stat-box">
					<div class="stat-label">Lines</div>
					<div class="stat-value">${state.totalLines}</div>
				</div>
				<div class="stat-box">
					<div class="stat-label">TODOs</div>
					<div class="stat-value">${state.totalTodos}</div>
				</div>
				<div class="stat-box">
					<div class="stat-label">FIXMEs</div>
					<div class="stat-value">${state.totalFixmes}</div>
				</div>
			</div>

			<div class="buttons">
				<button onclick="scanCurrentFile()">Scan Current File</button>
				<button onclick="scanWorkspace()">Scan Workspace</button>
				<button onclick="clearResults()" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);">Clear Results</button>
				<button onclick="openProblems()" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);">Open Problems</button>
			</div>

			<div class="results">
				<h3>Results</h3>
				${state.results.length === 0 ? '<p class="no-results">No scan results yet</p>' : resultsHtml}
			</div>

			<script>
				const vscode = acquireVsCodeApi();

				function scanCurrentFile() {
					vscode.postMessage({ command: 'scanCurrentFile' });
				}

				function scanWorkspace() {
					vscode.postMessage({ command: 'scanWorkspace' });
				}

				function clearResults() {
					vscode.postMessage({ command: 'clearResults' });
				}

				function openProblems() {
					vscode.postMessage({ command: 'openProblems' });
				}
			</script>
		</body>
		</html>
	`;
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Simple Code Scanner extension is now active');

	const output = vscode.window.createOutputChannel('Simple Code Scanner');
	const diagnostics = vscode.languages.createDiagnosticCollection('simple-code-scanner');

	let dashboardPanel: vscode.WebviewPanel | undefined;

	let dashboardState: DashboardState = createEmptyDashboardState();

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
		writeScanResult(output, result);
		output.appendLine('--------------------------------');
		output.appendLine(
			`TOTAL: 1 file, ${result.lineCount} lines, ${result.todoCount} TODOs, ${result.fixmeCount} FIXMEs`
		);

		dashboardState = {
			lastScanMode: 'currentFile',
			targetLabel: result.fileName,
			workspaceLabel: getWorkspaceLabel(),
			activeFileLabel: getActiveFileLabel(),
			totalFiles: 1,
			totalLines: result.lineCount,
			totalTodos: result.todoCount,
			totalFixmes: result.fixmeCount,
			results: [result],
		};

		updateDashboard(dashboardPanel, dashboardState);
	});

	const scanWorkspaceCommand = vscode.commands.registerCommand('noob-scan.scanWorkspace', async () => {
		const documents = await getWorkspaceDocuments();

		if (documents.length === 0) {
			output.show(true);
			output.appendLine('No files found in workspace');
			return;
		}

		diagnostics.clear();

		const results = documents.map(document => {
			const result = scanDocument(document);
			publishDiagnostics(document, result, diagnostics);
			return result;
		});

		const totalFiles = results.length;
		const totalLines = results.reduce((sum, result) => sum + result.lineCount, 0);
		const totalTodos = results.reduce((sum, result) => sum + result.todoCount, 0);
		const totalFixmes = results.reduce((sum, result) => sum + result.fixmeCount, 0);

		output.clear();
		output.show(true);
		output.appendLine('--- Simple Code Scanner ---');

		results.forEach(result => {
			writeScanResult(output, result);
		});

		output.appendLine('--------------------------------');
		output.appendLine(
			`TOTAL: ${totalFiles} files, ${totalLines} lines, ${totalTodos} TODOs, ${totalFixmes} FIXMEs`
		);

		dashboardState = {
			lastScanMode: 'workspace',
			targetLabel: getWorkspaceLabel(),
			workspaceLabel: getWorkspaceLabel(),
			activeFileLabel: getActiveFileLabel(),
			totalFiles,
			totalLines,
			totalTodos,
			totalFixmes,
			results,
		};

		updateDashboard(dashboardPanel, dashboardState);
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
					label: '$(dashboard) Open Dashboard',
					description: 'Open the scanner dashboard',
					action: 'openDashboard',
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
			return;
		}

		if (choice.action === 'scanWorkspace') {
			await vscode.commands.executeCommand('noob-scan.scanWorkspace');
			return;
		}

		if (choice.action === 'openDashboard') {
			await vscode.commands.executeCommand('noob-scan.openDashboard');
			return;
		}

		if (choice.action === 'clearOutput') {
			output.clear();
			diagnostics.clear();

			dashboardState = createEmptyDashboardState();
			updateDashboard(dashboardPanel, dashboardState);

			output.show(true);
			output.appendLine('Simple Code Scanner output and diagnostics cleared.');
		}
	});

	const openDashboardCommand = vscode.commands.registerCommand('noob-scan.openDashboard', () => {
		if (dashboardPanel) {
			dashboardPanel.reveal(vscode.ViewColumn.Beside);
			updateDashboard(dashboardPanel, dashboardState);
			return;
		}

		dashboardPanel = vscode.window.createWebviewPanel(
			'noobScanDashboard',
			'Simple Code Scanner',
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
			}
		);

		dashboardPanel.onDidDispose(() => {
			dashboardPanel = undefined;
		});

		dashboardPanel.webview.onDidReceiveMessage(async message => {
			if (message.command === 'scanCurrentFile') {
				await vscode.commands.executeCommand('noob-scan.scan');
			}

			if (message.command === 'scanWorkspace') {
				await vscode.commands.executeCommand('noob-scan.scanWorkspace');
			}

			if (message.command === 'clearResults') {
				output.clear();
				diagnostics.clear();

				dashboardState = createEmptyDashboardState();

				updateDashboard(dashboardPanel, dashboardState);
			}

			if (message.command === 'openProblems') {
				await vscode.commands.executeCommand('workbench.action.problems.focus');
			}
		});

		updateDashboard(dashboardPanel, dashboardState);
	});

	context.subscriptions.push(
		scanCurrentFileCommand,
		scanWorkspaceCommand,
		openScannerCommand,
		openDashboardCommand,
		diagnostics,
		output
	);
}

export function deactivate() { }

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
	const fixmeLines: number[] = [];

	const lines = text.split('\n');

	lines.forEach((line, index) => {
		if (line.includes('TODO')) {
			todoLines.push(index + 1);
		}

		if (line.includes('FIXME')) {
			fixmeLines.push(index + 1);
		}
	});

	return {
		fileName,
		lineCount,
		todoCount: todoLines.length,
		todoLines,
		fixmeCount: fixmeLines.length,
		fixmeLines,
	};
}

function writeScanResult(output: vscode.OutputChannel, result: ScanResult): void {
	output.appendLine(`${result.fileName}:`);

	if (result.todoCount === 0 && result.fixmeCount === 0) {
		output.appendLine('  no TODOs or FIXMEs');
		return;
	}

	if (result.todoCount > 0) {
		output.appendLine(`  TODO at lines ${result.todoLines.join(', ')}`);
	}

	if (result.fixmeCount > 0) {
		output.appendLine(`  FIXME at lines ${result.fixmeLines.join(', ')}`);
	}
}

function publishDiagnostics(
	document: vscode.TextDocument,
	result: ScanResult,
	diagnostics: vscode.DiagnosticCollection
): void {
	const vscodeDiagnostics: vscode.Diagnostic[] = [];

	for (const lineNumber of result.todoLines) {
		const diagnostic = createKeywordDiagnostic(
			document,
			lineNumber,
			'TODO',
			'TODO found',
			'debug.todo',
			vscode.DiagnosticSeverity.Information
		);

		if (diagnostic) {
			vscodeDiagnostics.push(diagnostic);
		}
	}

	for (const lineNumber of result.fixmeLines) {
		const diagnostic = createKeywordDiagnostic(
			document,
			lineNumber,
			'FIXME',
			'FIXME found',
			'debug.fixme',
			vscode.DiagnosticSeverity.Warning
		);

		if (diagnostic) {
			vscodeDiagnostics.push(diagnostic);
		}
	}

	diagnostics.set(document.uri, vscodeDiagnostics);
}

function createKeywordDiagnostic(
	document: vscode.TextDocument,
	lineNumber: number,
	keyword: string,
	message: string,
	code: string,
	severity: vscode.DiagnosticSeverity
): vscode.Diagnostic | undefined {
	const zeroBasedLine = lineNumber - 1;
	const lineText = document.lineAt(zeroBasedLine).text;
	const column = lineText.indexOf(keyword);

	if (column === -1) {
		return undefined;
	}

	const range = new vscode.Range(
		zeroBasedLine,
		column,
		zeroBasedLine,
		column + keyword.length
	);

	const diagnostic = new vscode.Diagnostic(range, message, severity);

	diagnostic.source = 'Simple Code Scanner';
	diagnostic.code = code;

	return diagnostic;
}