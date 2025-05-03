import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, addIcon } from 'obsidian';
import { getDailyNoteFile } from './daily-note-utils';

// Define the plugin settings interface
interface PomodoroPluginSettings {
	pomodoroLength: number;
	breakLength: number;
	longBreakLength: number;
	pomodoroCounterName: string;
	dailyNoteFolder: string;
	dailyNoteFormat: string;
}

// Default settings
const DEFAULT_SETTINGS: PomodoroPluginSettings = {
	pomodoroLength: 25, // 25 minutes
	breakLength: 5, // 5 minutes
	longBreakLength: 15, // 15 minutes
	pomodoroCounterName: 'pomodoros',
	dailyNoteFolder: '/Journal',
	dailyNoteFormat: 'YYYY-MM-DD'
}

// Timer status enum
enum TimerStatus {
	IDLE = 'idle',
	RUNNING = 'running',
	BREAK = 'break'
}

// Define the remaining time modal
class RemainingTimeModal extends Modal {
	plugin: PomodoroPlugin;
	
	constructor(app: App, plugin: PomodoroPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const {contentEl} = this;
		const remainingMinutes = Math.floor(this.plugin.remainingTime / 60);
		const remainingSeconds = this.plugin.remainingTime % 60;
		
		const title = this.plugin.timerStatus === TimerStatus.BREAK ? 'Break Time' : 'Pomodoro';
		contentEl.createEl('h2', {text: title});
		
		// Display time remaining - doesn't update automatically, too much worrk to implement
		// contentEl.createEl('p', {
		// 	text: `Remaining time: ${remainingMinutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`
		// });
		
		contentEl.createEl('p', {
			text: "Restarting pomodoros is kind of useless, but go for it..."
		});
		
		// Create buttons container
		const buttonContainer = contentEl.createDiv('button-container');
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'space-around';
		buttonContainer.style.marginTop = '20px';
		
		// Stop button
		const stopBtn = buttonContainer.createEl('button', {text: 'Stop'});
		stopBtn.addEventListener('click', () => {
			this.plugin.stopTimer();
			this.close();
		});
		
		// Restart button
		const restartBtn = buttonContainer.createEl('button', {text: 'Restart'});
		restartBtn.addEventListener('click', () => {
			this.plugin.restartTimer();
			this.close();
		});
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

export default class PomodoroPlugin extends Plugin {
	settings: PomodoroPluginSettings;
	timerStatus: TimerStatus = TimerStatus.IDLE;
	remainingTime: number = 0;
	interval: number | null = null;
	statusBarItem: HTMLElement;
	pomodoroCount: number = 0;
	
	// Update the pomodoro counter in the frontmatter of daily note
	async updatePomodoroCounter() {
		const today = window.moment();
		// Use the imported utility function instead of the class method
		const dailyNoteFile = await getDailyNoteFile(
			this.app,
			this.settings,
			today,
			`---\n${this.settings.pomodoroCounterName}: 0\n---\n\n`
		);

		if (!dailyNoteFile) return;
		
		try {
			// Read the file content
			const content = await this.app.vault.read(dailyNoteFile);
			// Find the frontmatter
			const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
			const match = content.match(frontmatterRegex);

			if (match && match[1]) {
				const frontmatter = match[1];
				console.table(frontmatter)
				const pomodoroRegex = new RegExp(`(${this.settings.pomodoroCounterName}\\s*:\\s*)(\\d+)`, 'i');
				const pomodoroMatch = frontmatter.match(pomodoroRegex);
				
				let newFrontmatter;
				let currentCount = 0;
				
				if (pomodoroMatch) {
					// Pomodoro counter exists, increment it
					currentCount = parseInt(pomodoroMatch[2]);
					currentCount++;
					newFrontmatter = frontmatter.replace(pomodoroRegex, `$1${currentCount}`);
				} else {
					// Pomodoro counter doesn't exist, add it
					currentCount = 1;
					newFrontmatter = frontmatter + `\n${this.settings.pomodoroCounterName}: ${currentCount}`;
				}
				
				// Update file content with new frontmatter
				const newContent = content.replace(frontmatterRegex, `---\n${newFrontmatter}\n---`);
				await this.app.vault.modify(dailyNoteFile, newContent);
				
				this.pomodoroCount = currentCount;
			} else {
				// No frontmatter found, add one
				const newContent = `---\n${this.settings.pomodoroCounterName}: 1\n---\n\n${content}`;
				await this.app.vault.modify(dailyNoteFile, newContent);
				this.pomodoroCount = 1;
			}
		} catch (err) {
			new Notice('Failed to update pomodoro counter');
			console.error('Failed to update pomodoro counter:', err);
		}
	}

	async onload() {
		await this.loadSettings();

		// Add pomodoro icon to the status bar
		this.statusBarItem = this.addStatusBarItem();
		this.statusBarItem.setText('🍅 Idle');
		
		// Add click handler to status bar item
		this.statusBarItem.onClickEvent(() => {
			if (this.timerStatus !== TimerStatus.IDLE) {
				new RemainingTimeModal(this.app, this).open();
			} else {
				new Notice('No active pomodoro. Start one from the command palette.');
			}
		});


		// Add DEBUG command
		this.addCommand({
			id: 'test-pomodoro',
			name: 'test Pomodoro',
			callback: () => {
				console.log("So many 🍅")
				this.updatePomodoroCounter();
			}
		});

		// Add the start pomodoro command
		this.addCommand({
			id: 'start-pomodoro',
			name: 'Start Pomodoro',
			callback: () => {
				this.startPomodoro();
			}
		});

		// Add the stop pomodoro command
		this.addCommand({
			id: 'stop-pomodoro',
			name: 'Stop Pomodoro',
			callback: () => {
				this.stopTimer();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new PomodoroSettingTab(this.app, this));
	}

	onunload() {
		this.stopTimer();
		console.log("🍅 splattered unceremoniously...")
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
	
	startPomodoro() {
		// If timer is already running, do nothing
		if (this.timerStatus !== TimerStatus.IDLE) return;
		
		this.timerStatus = TimerStatus.RUNNING;
		this.remainingTime = this.settings.pomodoroLength * 60;
		this.updateStatusBar();
		new Notice('🍅 started!');
		
		// Start the interval
		this.interval = window.setInterval(() => {
			this.tick();
		}, 1000);
	}
	
	startBreak(isLongBreak: boolean = false) {
		this.timerStatus = TimerStatus.BREAK;
		this.remainingTime = isLongBreak ? 
			this.settings.longBreakLength * 60 : 
			this.settings.breakLength * 60;
		this.updateStatusBar();
		
		const breakType = isLongBreak ? 'long break' : 'short break';
		new Notice(`Pomodoro completed! Starting ${breakType}`);
		
		// Start the interval if it's not already running
		if (!this.interval) {
			this.interval = window.setInterval(() => {
				this.tick();
			}, 1000);
		}
	}
	
	stopTimer() {
		let msg = 'No 🍅 timer running'
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
			msg = '🍅 timer stopped';
		}
		
		this.timerStatus = TimerStatus.IDLE;
		this.updateStatusBar();
		new Notice(msg);
	}
	
	restartTimer() {
		this.stopTimer();
		if (this.timerStatus === TimerStatus.BREAK) {
			this.startBreak(this.pomodoroCount % 3 === 0);
		} else {
			this.startPomodoro();
		}
	}
	
	tick() {
		if (this.remainingTime > 0) {
			this.remainingTime--;
			this.updateStatusBar();
		} else {
			// Timer completed
			if (this.timerStatus === TimerStatus.RUNNING) {
				// Pomodoro completed
				this.updatePomodoroCounter();
				
				// Check if it's time for a long break (after 3 pomodoros)
				if (this.pomodoroCount % 3 === 0) {
					this.startBreak(true);
				} else {
					this.startBreak();
				}
			} else {
				// Break completed
				this.stopTimer();
				new Notice('Break completed! Start a new pomodoro?');
			}
		}
	}
	
	updateStatusBar() {
		const minutes = Math.floor(this.remainingTime / 60);
		const seconds = this.remainingTime % 60;
		const timeStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
		
		if (this.timerStatus === TimerStatus.RUNNING) {
			this.statusBarItem.setText(`🍅 ${timeStr}`);
		} else if (this.timerStatus === TimerStatus.BREAK) {
			this.statusBarItem.setText(`☕ ${timeStr}`);
		} else {
			this.statusBarItem.setText('🍅 Idle');
		}
	}
}

class PomodoroSettingTab extends PluginSettingTab {
	plugin: PomodoroPlugin;

	constructor(app: App, plugin: PomodoroPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: '🍅 Pomodoro Timer Settings'});

		containerEl.createEl('h3', {text: 'Daily Note Settings'});

		//Use settings, unless core plugin is enabled 
		const dailyNotesPlugin = app.internalPlugins.getPluginById("daily-notes");
		if (dailyNotesPlugin?.enabled) {
			containerEl.createEl('p', {text: 'Location and format are taken from the core daily note plugin'});
		} else {	
			// Daily Note folder setting
			new Setting(containerEl)
			.setName('Daily notes folder')
			.setDesc('Folder where your daily notes are stored')
			.addText(text => text
				.setPlaceholder('/')
				.setValue(this.plugin.settings.dailyNoteFolder)
				.onChange(async (value) => {
					this.plugin.settings.dailyNoteFolder = value;
					await this.plugin.saveSettings();
				}));
				
				// Daily Note format setting
				new Setting(containerEl)
				.setName('Daily note format')
				.setDesc('Format for daily note filenames (uses moment.js format)')
				.addText(text => text
					.setPlaceholder('YYYY-MM-DD')
					.setValue(this.plugin.settings.dailyNoteFormat)
					.onChange(async (value) => {
						this.plugin.settings.dailyNoteFormat = value;
						await this.plugin.saveSettings();
					}));
		}

		containerEl.createEl('h3', {text: '🍅 Pomodoro Settings'});		

		new Setting(containerEl)
			.setName('Pomodoro Length')
			.setDesc('Length of a pomodoro session in minutes')
			.addText(text => text
				.setPlaceholder('25')
				.setValue(this.plugin.settings.pomodoroLength.toString())
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue > 0) {
						this.plugin.settings.pomodoroLength = numValue;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Short Break Length')
			.setDesc('Length of a short break in minutes')
			.addText(text => text
				.setPlaceholder('5')
				.setValue(this.plugin.settings.breakLength.toString())
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue > 0) {
						this.plugin.settings.breakLength = numValue;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Long Break Length')
			.setDesc('Length of a long break in minutes (after 3 pomodoros)')
			.addText(text => text
				.setPlaceholder('15')
				.setValue(this.plugin.settings.longBreakLength.toString())
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue > 0) {
						this.plugin.settings.longBreakLength = numValue;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Frontmatter Counter Name')
			.setDesc('Name of the counter in daily note frontmatter')
			.addText(text => text
				.setPlaceholder('pomodoros')
				.setValue(this.plugin.settings.pomodoroCounterName)
				.onChange(async (value) => {
					if (value) {
						this.plugin.settings.pomodoroCounterName = value;
						await this.plugin.saveSettings();
					}
				}));
	}
}