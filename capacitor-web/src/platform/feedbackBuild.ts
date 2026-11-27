const env = import.meta.env ?? {};
export const feedbackBuild = env.MODE === 'feedback';
export const localTestEntryEnabled = !!env.DEV || feedbackBuild;
