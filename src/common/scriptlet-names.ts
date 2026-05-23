export type ScriptletName = 'set-cookie' | 'remove-cookie' | 'set-local-storage-item' | 'set-session-storage-item' | 'set-constant' | 'remove-class'

export type ScriptletCommand = [ScriptletName, ...string[]]