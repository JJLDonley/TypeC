import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
} from "vscode-languageclient/node";

type Str = string;
type b8 = boolean;

const CONFIG_SECTION: Str = "typec";
const COMPILER_PATH_SETTING: Str = "compilerPath";
const BUILD_DIR_SETTING: Str = "buildDir";
const TRACE_SERVER_SETTING: Str = "trace.server";
const LANGUAGE_ID: Str = "typec";
const CLIENT_ID: Str = "typecLanguageServer";
const CLIENT_NAME: Str = "TypeC Language Server";
const CHECK_CURRENT_FILE_COMMAND: Str = "typec.checkCurrentFile";
const BUILD_CURRENT_FILE_COMMAND: Str = "typec.buildCurrentFile";
const RUN_CURRENT_FILE_COMMAND: Str = "typec.runCurrentFile";
const CLEAN_CURRENT_FILE_COMMAND: Str = "typec.cleanCurrentFile";
const WATCH_CURRENT_FILE_COMMAND: Str = "typec.watchCurrentFile";
const FORMAT_CURRENT_FILE_COMMAND: Str = "typec.formatCurrentFile";
const FORMAT_CHECK_CURRENT_FILE_COMMAND: Str = "typec.formatCheckCurrentFile";
const PARSE_CURRENT_FILE_COMMAND: Str = "typec.parseCurrentFile";
const EMIT_C_CURRENT_FILE_COMMAND: Str = "typec.emitCCurrentFile";
const EMIT_AST_CURRENT_FILE_COMMAND: Str = "typec.emitAstCurrentFile";
const RESTART_LANGUAGE_SERVER_COMMAND: Str = "typec.restartLanguageServer";
const SHOW_LANGUAGE_SERVER_OUTPUT_COMMAND: Str = "typec.showLanguageServerOutput";
const SHOW_COMPILER_VERSION_COMMAND: Str = "typec.showCompilerVersion";
const SHOW_COMPILER_HELP_COMMAND: Str = "typec.showCompilerHelp";
const CONFIGURE_COMPILER_PATH_COMMAND: Str = "typec.configureCompilerPath";
const CONFIGURE_BUILD_DIR_COMMAND: Str = "typec.configureBuildDir";
const CONFIGURE_LANGUAGE_SERVER_TRACE_COMMAND: Str = "typec.configureLanguageServerTrace";
const CONFIGURE_SETTINGS_COMMAND: Str = "typec.configureSettings";
const EXTENSION_SETTINGS_QUERY: Str = "@ext:typec.typec-vscode";
const TYPEC_TASK_TYPE: Str = "typec";
const TASK_SOURCE: Str = "TypeC";
const TYPEC_PROBLEM_MATCHER: Str = "$typec";

interface TypeCTaskDefinition extends vscode.TaskDefinition {
  type: Str;
}

interface TypeCSourceTarget {
  uri: vscode.Uri;
}

let client: LanguageClient | undefined;
let output: vscode.OutputChannel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  startLanguageServer(context);
  context.subscriptions.push(checkCurrentFileCommand(context));
  context.subscriptions.push(buildCurrentFileCommand(context));
  context.subscriptions.push(runCurrentFileCommand(context));
  context.subscriptions.push(cleanCurrentFileCommand(context));
  context.subscriptions.push(watchCurrentFileCommand(context));
  context.subscriptions.push(formatCurrentFileCommand(context));
  context.subscriptions.push(formatCheckCurrentFileCommand(context));
  context.subscriptions.push(parseCurrentFileCommand(context));
  context.subscriptions.push(emitCCurrentFileCommand(context));
  context.subscriptions.push(emitAstCurrentFileCommand(context));
  context.subscriptions.push(restartLanguageServerCommand(context));
  context.subscriptions.push(showLanguageServerOutputCommand());
  context.subscriptions.push(showCompilerVersionCommand(context));
  context.subscriptions.push(showCompilerHelpCommand(context));
  context.subscriptions.push(configureCompilerPathCommand());
  context.subscriptions.push(configureBuildDirCommand());
  context.subscriptions.push(configureLanguageServerTraceCommand());
  context.subscriptions.push(configureSettingsCommand());
  context.subscriptions.push(typeCTaskProvider(context));
}

export function deactivate(): Thenable<void> | undefined {
  const activeClient = client;
  client = undefined;
  output?.dispose();
  output = undefined;
  return activeClient?.stop();
}

function startLanguageServer(context: vscode.ExtensionContext): void {
  const nextClient = createClient(context);
  client = nextClient;
  void nextClient.start();
}

async function restartLanguageServer(
  context: vscode.ExtensionContext,
): Promise<void> {
  const activeClient = client;
  client = undefined;
  if (activeClient !== undefined) await activeClient.stop();
  const nextClient = createClient(context);
  client = nextClient;
  await nextClient.start();
  void vscode.window.showInformationMessage("TypeC language server restarted.");
}

function createClient(context: vscode.ExtensionContext): LanguageClient {
  return new LanguageClient(
    CLIENT_ID,
    CLIENT_NAME,
    serverOptions(context),
    clientOptions(),
  );
}

function serverOptions(context: vscode.ExtensionContext): ServerOptions {
  return {
    command: compilerCommand(context),
    args: ["lsp"],
    options: { cwd: workspaceDirectory() },
  };
}

function clientOptions(): LanguageClientOptions {
  return {
    documentSelector: [{ scheme: "file", language: LANGUAGE_ID }],
    synchronize: {
      configurationSection: CONFIG_SECTION,
    },
    traceOutputChannel: outputChannel(),
  };
}

function checkCurrentFileCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return currentFileCommand(context, CHECK_CURRENT_FILE_COMMAND, "check");
}

function buildCurrentFileCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return currentFileCommand(context, BUILD_CURRENT_FILE_COMMAND, "build");
}

function runCurrentFileCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return currentFileCommand(context, RUN_CURRENT_FILE_COMMAND, "run");
}

function cleanCurrentFileCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return currentFileCommand(context, CLEAN_CURRENT_FILE_COMMAND, "clean");
}

function watchCurrentFileCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return currentFileCommand(context, WATCH_CURRENT_FILE_COMMAND, "watch");
}

function formatCurrentFileCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return currentFileCommand(context, FORMAT_CURRENT_FILE_COMMAND, "fmt");
}

function formatCheckCurrentFileCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return currentFileCommand(
    context,
    FORMAT_CHECK_CURRENT_FILE_COMMAND,
    "fmt-check",
  );
}

function parseCurrentFileCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return currentFileCommand(context, PARSE_CURRENT_FILE_COMMAND, "parse");
}

function emitCCurrentFileCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return currentFileCommand(context, EMIT_C_CURRENT_FILE_COMMAND, "emit-c");
}

function emitAstCurrentFileCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return currentFileCommand(context, EMIT_AST_CURRENT_FILE_COMMAND, "emit-ast");
}

function restartLanguageServerCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    RESTART_LANGUAGE_SERVER_COMMAND,
    () => {
      void restartLanguageServer(context);
    },
  );
}

function showLanguageServerOutputCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    SHOW_LANGUAGE_SERVER_OUTPUT_COMMAND,
    () => {
      outputChannel().show();
    },
  );
}

function showCompilerVersionCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand(SHOW_COMPILER_VERSION_COMMAND, () => {
    void vscode.tasks.executeTask(compilerTask(context, "version"));
  });
}

function showCompilerHelpCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand(SHOW_COMPILER_HELP_COMMAND, () => {
    void vscode.tasks.executeTask(compilerTask(context, "help"));
  });
}

function configureCompilerPathCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    CONFIGURE_COMPILER_PATH_COMMAND,
    () => {
      openSetting(COMPILER_PATH_SETTING);
    },
  );
}

function configureBuildDirCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(CONFIGURE_BUILD_DIR_COMMAND, () => {
    openSetting(BUILD_DIR_SETTING);
  });
}

function configureLanguageServerTraceCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    CONFIGURE_LANGUAGE_SERVER_TRACE_COMMAND,
    () => {
      openSetting(TRACE_SERVER_SETTING);
    },
  );
}

function configureSettingsCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(CONFIGURE_SETTINGS_COMMAND, () => {
    openSettingsQuery(EXTENSION_SETTINGS_QUERY);
  });
}

function openSetting(setting: Str): void {
  openSettingsQuery(`${CONFIG_SECTION}.${setting}`);
}

function openSettingsQuery(query: Str): void {
  void vscode.commands.executeCommand(
    "workbench.action.openSettings",
    query,
  );
}

function typeCTaskProvider(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.tasks.registerTaskProvider(TYPEC_TASK_TYPE, {
    provideTasks: () => providedTypeCTasks(context),
    resolveTask: () => undefined,
  });
}

function providedTypeCTasks(context: vscode.ExtensionContext): vscode.Task[] {
  const target = activeTypeCSourceTarget();
  return target === null ? [] : [typeCTask(context, target, "build")];
}

function currentFileCommand(
  context: vscode.ExtensionContext,
  command: Str,
  action: Str,
): vscode.Disposable {
  return vscode.commands.registerCommand(command, (uri?: vscode.Uri) => {
    const target = currentFileTarget(uri);
    if (target === null) {
      void vscode.window.showErrorMessage(
        `Select or open a TypeC .tc file before running ${action}.`,
      );
      return;
    }
    void vscode.tasks.executeTask(typeCTask(context, target, action));
  });
}

function currentFileTarget(
  uri: vscode.Uri | undefined,
): TypeCSourceTarget | null {
  if (uri !== undefined) return sourceTargetFromUri(uri);
  return activeTypeCSourceTarget();
}

function sourceTargetFromUri(uri: vscode.Uri): TypeCSourceTarget | null {
  return isTypeCFileUri(uri) ? { uri } : null;
}

function activeTypeCSourceTarget(): TypeCSourceTarget | null {
  const document = activeTypeCDocument();
  return document === null ? null : { uri: document.uri };
}

function activeTypeCDocument(): vscode.TextDocument | null {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) return null;
  const document = editor.document;
  return isTypeCDocument(document) ? document : null;
}

function isTypeCDocument(document: vscode.TextDocument): b8 {
  return document.languageId === LANGUAGE_ID && isTypeCFileUri(document.uri);
}

function isTypeCFileUri(uri: vscode.Uri): b8 {
  return uri.scheme === "file" && uri.fsPath.endsWith(".tc");
}

function typeCTask(
  context: vscode.ExtensionContext,
  target: TypeCSourceTarget,
  action: Str,
): vscode.Task {
  const task = new vscode.Task(
    taskDefinition(),
    taskScope(target.uri),
    `${action} current file`,
    TASK_SOURCE,
    compilerExecution(
      context,
      typeCArgs(action, target),
      taskWorkingDirectory(target.uri),
    ),
    currentFileProblemMatchers(),
  );
  assignTaskGroup(task, action);
  return task;
}

function assignTaskGroup(task: vscode.Task, action: Str): void {
  const group = taskGroup(action);
  if (group !== undefined) task.group = group;
}

function taskGroup(action: Str): vscode.TaskGroup | undefined {
  return action === "build" ? vscode.TaskGroup.Build : undefined;
}

function currentFileProblemMatchers(): Str[] {
  return [TYPEC_PROBLEM_MATCHER];
}

function typeCArgs(action: Str, target: TypeCSourceTarget): readonly Str[] {
  const baseArgs: readonly Str[] = [action, target.uri.fsPath];
  const buildDirectory = configuredBuildDirectory();
  if (buildDirectory === "" || !usesBuildDirectory(action)) return baseArgs;
  return [...baseArgs, "--build-dir", buildDirectory];
}

function usesBuildDirectory(action: Str): b8 {
  return action === "build" ||
    action === "run" ||
    action === "clean" ||
    action === "watch";
}

function compilerTask(
  context: vscode.ExtensionContext,
  action: Str,
): vscode.Task {
  return new vscode.Task(
    taskDefinition(),
    vscode.TaskScope.Workspace,
    action,
    TASK_SOURCE,
    compilerExecution(context, [action], workspaceDirectory()),
    [],
  );
}

function taskDefinition(): TypeCTaskDefinition {
  return { type: TYPEC_TASK_TYPE };
}

function compilerExecution(
  context: vscode.ExtensionContext,
  args: readonly Str[],
  cwd: Str | undefined,
): vscode.ProcessExecution {
  return new vscode.ProcessExecution(
    compilerCommand(context),
    [...args],
    { cwd },
  );
}

function taskScope(
  uri: vscode.Uri,
): vscode.WorkspaceFolder | vscode.TaskScope {
  return vscode.workspace.getWorkspaceFolder(uri) ?? vscode.TaskScope.Workspace;
}

function taskWorkingDirectory(uri: vscode.Uri): Str | undefined {
  return vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath ??
    workspaceDirectory();
}

function compilerCommand(context: vscode.ExtensionContext): Str {
  const configuredPath = configuredCompilerPath();
  if (configuredPath !== "") return configuredPath;
  const bundledPath = bundledCompilerPath(context);
  return fileExists(bundledPath) ? bundledPath : "STC";
}

function configuredCompilerPath(): Str {
  return vscode.workspace.getConfiguration(CONFIG_SECTION).get<Str>(
    COMPILER_PATH_SETTING,
    "",
  );
}

function configuredBuildDirectory(): Str {
  return vscode.workspace.getConfiguration(CONFIG_SECTION).get<Str>(
    BUILD_DIR_SETTING,
    "",
  );
}

function bundledCompilerPath(context: vscode.ExtensionContext): Str {
  return path.resolve(context.extensionPath, "..", "bin", executableName());
}

function executableName(): Str {
  return process.platform === "win32" ? "STC.exe" : "STC";
}

function fileExists(filePath: Str): b8 {
  return fs.existsSync(filePath);
}

function workspaceDirectory(): Str | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function outputChannel(): vscode.OutputChannel {
  const activeOutput = output;
  if (activeOutput !== undefined) return activeOutput;
  const nextOutput = vscode.window.createOutputChannel(CLIENT_NAME);
  output = nextOutput;
  return nextOutput;
}
