// web app settings

export const API_KEY_DEFINE = 'gemini_chat_app_api_key';
export const MODEL_DEFINE = 'gemini_chat_app_model';
export const CHAT_HISTORY_LIST_DEFINE = 'gemini-chat-history_v1';
export const DEFAULT_LIST_NAME = 'gemini-chat-history-default';
export const DEFAULT_LIST_SELECTED_NAME = 'default';

export const EMPTY_HISTORY_LIST = [{
    'name': DEFAULT_LIST_SELECTED_NAME,
    'history': []
}];

// models define
export const MODEL_LIST_DEFINE = [
    { key: 'gemini-2.0-flash-exp', value: ' Gemini 2.0 Flash Experimental  (最新)' },
    { key: 'gemini-1.5-flash-latest', value: 'Gemini 1.5 Flash' },
    { key: 'gemini-1.5-flash-002', value: 'Gemini 1.5 Flash 002' },
    { key: 'gemini-1.5-flash-8b', value: 'Gemini 1.5 Flash 8b' },
    { key: 'gemini-1.0-pro', value: 'Gemini 1.0 Pro' }];

// chat context length define
export const CHAT_CONTEXT_LIST_DEFINE = [{ key: '6', value: '6' },
{ key: '12', value: '12' },
{ key: '32', value: '32' },
{ key: '64', value: '64' }];

export const CHAT_CONTEXT_DEFAULT = 'context-length';
