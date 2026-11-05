// 空闲自动压缩。挂在预设的 compaction 组里，所以能拿到 ctx.compaction。
// 规则：agent 空闲 idleMs 之后，如果上下文已用到窗口的 ratio，就压一次。
// 用的是 compactNow，和 /compact 完全一样：只保留最后一条消息，其余进摘要。

export const name = 'compaction-idle'
export const inject = ['compaction', 'tokenMeter', 'llm', 'timer']

export function apply(ctx, config) {
  const ratio = config?.ratio ?? 0.4
  const idleMs = config?.idleMs ?? 300000
  const pending = new Map()

  function cancel(agent) {
    const dispose = pending.get(agent)
    if (dispose === undefined) return
    dispose()
    pending.delete(agent)
  }

  function arm(agent) {
    cancel(agent)
    pending.set(agent, ctx.timeout(() => {
      pending.delete(agent)
      void run(agent)
    }, idleMs))
  }

  async function run(agent) {
    try {
      if (agent.status !== 'idle') return
      const provider = agent.options.provider
      const model = agent.options.model
      if (provider === undefined || model === undefined) return
      const info = await ctx.llm.resolveModelInfo(provider, model)
      const window = info.context?.contextWindow
      if (window === undefined) return
      const used = ctx.tokenMeter.measure(agent.session).totalTokens
      if (used < window * ratio) return
      if (agent.status !== 'idle') return
      const result = await ctx.compaction.compactNow(agent, new AbortController().signal)
      if (result !== null) {
        ctx.logger.info(`idle compaction: shadowed ${result.shadowedSeqs.length} nodes (~${result.shadowedTokenCount} tokens)`)
      }
    } catch (error) {
      ctx.logger.warn(`idle compaction skipped: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  ctx.on('agent/status', ({ agent, status }) => {
    if (status === 'idle') arm(agent)
    else cancel(agent)
  })
  ctx.on('agent/disposed', ({ agent }) => cancel(agent))
}
