---
title: "Visual Studio Code Settings and Configuration"
slug: visual-studio-code-configuration
summary: "Recommended configuration for a general-purpose dev environment in VS Code"
date: 2020-05-07
weight: 9
---

## The Basics: Essential Configuration for VS Code

Visual Studio Code has become popular in part for how easily it can be configured and extended to suit your preferences and needs. This power and flexibility can quickly lead you down a rabbit hole of configuration options, particularly as you begin to add support for your preferred prgramming languages.

Here we focus on just a handful of basic configuration options to start off your VS Code experience with clean and convenient workspace, while still offering a taste of how customized the experience can get.

### Settings

Settings can be most easily and completely configured by editing the `settings.json` file. On Mac OS installs of VS Code, it is located at `~/Library/Application\ Support/Code/User/settings.json`

```text
{
    // General VSCode stuff to get out of the way
    // Don't let Microsoft creep on your usage
    "telemetry.enableTelemetry": false,
    "telemetry.enableCrashReporter": false,
    "telemetry.telemetryLevel": "off"
    // Don't open the VSCode Welcome page on startup
    "workbench.startupEditor": "newUntitledFile",
    // I find that it's a little too easy to accidentally drag
    // code blocks around with my mouse, so I turn this off
    "editor.dragAndDrop": false,
    // Appearance - Overall
    // Font & Text
    "editor.renderWhitespace": "all",
    "editor.fontSize": 14,
    // Add your preferred font (mine is Hack) to the front of default font list
    "editor.fontFamily": "Hack, Menlo, Monaco, 'Courier New', monospace",
    // Theme
    "workbench.colorTheme": "Monokai Dimmed",
    // Ignore files we don't care about seeing in our filetree side bar
    "files.exclude": {
        "**/.idea": true,
        "**/.vscode": true
    },
    // Appearance - Editor & Terminal
    // Turn off code preview pane to leave more room in the editor window
    "editor.minimap.enabled": false,
    // General Coding Editing Settings
    // Autosave files after some number of milliseconds
    "files.autoSave": "afterDelay",
    "files.autoSaveDelay": 750,
    "editor.formatOnSave": true,
    // Language-Specific Code Editing Settings
    "go.formatTool": "goimports",
    "go.useLanguageServer": true,
}
```