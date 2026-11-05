# @local/compaction-idle

Idle-time automatic compaction for DSH.

When an Agent has been idle for `idleMs` and its context has reached `ratio`
of the model window, compact once. It uses `compactNow`, the same path as
`/compact`.

## Profile patch

This plugin belongs inside the `compaction` group. Add it as a normal
dependency of the profile, then use the package name in the group:
```yaml
- id: compaction-idle
  name: '@local/compaction-idle'
  config:
    ratio: 0.4
    idleMs: 300000
```
