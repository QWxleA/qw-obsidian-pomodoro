import { App, TFile, Notice } from 'obsidian';

interface DailyNoteSettings {
    dailyNoteFolder: string;
    dailyNoteFormat: string;
    pomodoroCounterName?: string;
}

/**
 * Get today's daily note file or create it if it doesn't exist
 * @param app - Obsidian App instance
 * @param settings - Settings containing dailyNoteFolder and dailyNoteFormat
 * @param workDate - Moment date object to use (typically today)
 * @param frontmatterTemplate - Optional template for frontmatter when creating a new note
 * @returns Promise resolving to the daily note TFile or null if creation failed
 */
export async function getDailyNoteFile(
    app: App, 
    settings: DailyNoteSettings,
    workDate: any, // Using 'any' for moment as it's not directly imported
    frontmatterTemplate?: string
): Promise<TFile | null> {
    const { dailyNoteFolder, dailyNoteFormat } = settings;
    let dailyNotesFolder: string;
    let today: string;

    dailyNotesFolder = dailyNoteFolder; 
    today = workDate.format(dailyNoteFormat);

    // Use settings, unless core plugin is enabled 
    const dailyNotesPlugin = app.internalPlugins.getPluginById("daily-notes");
    if (dailyNotesPlugin?.enabled) {
        const dailySettings = dailyNotesPlugin.instance.options;
        dailyNotesFolder = dailySettings.folder;
        today = workDate.format(dailySettings.format);		
    } 
    
    // Check if file exists
    const files = app.vault.getFiles();
    const dailyNoteFile = files.find(file => {
        return file.path === `${dailyNotesFolder}/${today}.md` || file.path === `${today}.md`;
    });
    
    if (dailyNoteFile) {
        return dailyNoteFile;
    }
    
    // File doesn't exist, try to create it
    let initialContent = '';
    
    // If frontmatterTemplate is provided, use it, otherwise create minimal frontmatter
    if (frontmatterTemplate) {
        initialContent = frontmatterTemplate;
    } else if (settings.pomodoroCounterName) {
        initialContent = `---\n${settings.pomodoroCounterName}: 0\n---\n\n`;
    } else {
        initialContent = '---\n---\n\n';
    }
    
    try {
        return await app.vault.create(`${dailyNotesFolder}/${today}.md`, initialContent);
    } catch (e) {
        // If folder doesn't exist, try to create in root
        try {
            return await app.vault.create(`${today}.md`, initialContent);
        } catch (err) {
            new Notice('Could not create daily note file');
            return null;
        }
    }
}

/**
 * Get the daily note for a specific date, or null if it doesn't exist
 * @param app - Obsidian App instance
 * @param settings - Settings containing dailyNoteFolder and dailyNoteFormat
 * @param date - Moment date object
 * @returns The daily note TFile or null if it doesn't exist
 */
export function getDailyNote(
    app: App,
    settings: DailyNoteSettings,
    date: any // Using 'any' for moment as it's not directly imported
): TFile | null {
    const { dailyNoteFolder, dailyNoteFormat } = settings;
    let dailyNotesFolder: string = dailyNoteFolder;
    let formattedDate: string = date.format(dailyNoteFormat);

    // Use settings, unless core plugin is enabled 
    const dailyNotesPlugin = app.internalPlugins.getPluginById("daily-notes");
    if (dailyNotesPlugin?.enabled) {
        const dailySettings = dailyNotesPlugin.instance.options;
        dailyNotesFolder = dailySettings.folder;
        formattedDate = date.format(dailySettings.format);		
    } 
    
    // Check if file exists
    const files = app.vault.getFiles();
    return files.find(file => {
        return file.path === `${dailyNotesFolder}/${formattedDate}.md` || file.path === `${formattedDate}.md`;
    }) || null;
}