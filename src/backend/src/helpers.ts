import { config } from "./pkg-config";

export const removeCommandPrefix = (text: string) => text.charAt(0) === config.commands.prefix ? text.slice(1) : text;
export const addCommandPrefix = (text: string) => config.commands.prefix + text;
export const log = (message: unknown) => console.log(getDate(), message);
export const logError = (message: unknown) => console.error(getDate(), message);
export const formatTime = (num: number) => num > 9 ? num : ("0" + num);
export function getDate() {
    const date = new Date();
    return `[${formatTime(date.getHours())}:${formatTime(date.getMinutes())}]`;
}
