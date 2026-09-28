const glados = async () => {
  const notice = []
  let hasError = false

  if (!process.env.GLADOS) {
    return {
      notice: ['Checkin Error', 'GLADOS Secret 未配置'],
      hasError: true,
    }
  }

  const cookies = String(process.env.GLADOS)
    .split('\n')
    .map(v => v.trim())
    .filter(Boolean)

  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i]
    const account = `账号 ${i + 1}`

    try {
      const common = {
        cookie,
        referer: 'https://glados.cloud/console/checkin',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36',
      }

      // 1. 签到
      const actionRes = await fetch('https://glados.cloud/api/user/checkin', {
        method: 'POST',
        headers: {
          ...common,
          'content-type': 'application/json',
        },
        body: '{"token":"glados.cloud"}',
      })

      if (!actionRes.ok) {
        throw new Error(`签到接口 HTTP ${actionRes.status}`)
      }

      const action = await actionRes.json()

      // GLaDOS API code != 0 表示异常
      if (action?.code) {
        const msg = action?.message || `API error code: ${action.code}`

        if (
          msg.includes('没有权限') ||
          msg.toLowerCase().includes('unauthorized') ||
          msg.toLowerCase().includes('login')
        ) {
          throw new Error(`Cookie 失效：${msg}`)
        }

        throw new Error(msg)
      }

      // 2. 查询剩余天数
      const statusRes = await fetch('https://glados.cloud/api/user/status', {
        method: 'GET',
        headers: common,
      })

      if (!statusRes.ok) {
        throw new Error(`状态接口 HTTP ${statusRes.status}`)
      }

      const status = await statusRes.json()

      if (status?.code) {
        const msg = status?.message || `API error code: ${status.code}`

        if (
          msg.includes('没有权限') ||
          msg.toLowerCase().includes('unauthorized') ||
          msg.toLowerCase().includes('login')
        ) {
          throw new Error(`Cookie 失效：${msg}`)
        }

        throw new Error(msg)
      }

      const leftDays = Number(status?.data?.leftDays)
      const message = action?.message || '签到成功'

      // 区分“今天新签到”和“重复签到”
      if (
        message.toLowerCase().includes('repeat') ||
        message.toLowerCase().includes('already')
      ) {
        notice.push(
          `✅ ${account} 今日已签到`,
          `${message}`,
          `剩余天数：${Number.isFinite(leftDays) ? leftDays : '未知'}`
        )
      } else {
        notice.push(
          `✅ ${account} 签到成功`,
          `${message}`,
          `剩余天数：${Number.isFinite(leftDays) ? leftDays : '未知'}`
        )
      }
    } catch (error) {
      hasError = true

      const message =
        error instanceof Error ? error.message : String(error)

      let title = `❌ ${account} 签到失败`

      if (
        message.includes('Cookie 失效') ||
        message.includes('没有权限') ||
        message.toLowerCase().includes('unauthorized')
      ) {
        title = `⚠️ ${account} Cookie 已失效`
      }

      notice.push(
        title,
        message,
        `<${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}>`
      )
    }
  }

  return { notice, hasError }
}

const notify = async (notice) => {
  if (!process.env.NOTIFY || !notice || notice.length === 0) return

  for (const option of String(process.env.NOTIFY).split('\n')) {
    if (!option) continue

    try {
      if (option.startsWith('pushplus:')) {
        const token = option.split(':')[1]

        const res = await fetch('https://www.pushplus.plus/send', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            token,
            title: notice.some(v => String(v).includes('❌') || String(v).includes('⚠️'))
              ? 'GLaDOS 签到异常'
              : 'GLaDOS 签到成功',
            content: notice.join('<br>'),
            template: 'markdown',
          }),
        }).then(r => r.json())

        console.log('Pushplus result:', res)
      }
    } catch (error) {
      console.error('Push failed:', error)
    }
  }
}

const main = async () => {
  try {
    const result = await glados()

    if (!result || !result.notice || result.notice.length === 0) {
      console.log('No checkin notice to send')
      process.exitCode = 1
      return
    }

    console.log('Sending notice:', result.notice)

    await notify(result.notice)

    console.log('Push finished')

    // 通知发完以后再让 Actions 标红
    if (result.hasError) {
      console.error('One or more GLaDOS accounts failed.')
      process.exitCode = 1
    }
  } catch (err) {
    console.error('Unexpected error:', err)
    process.exitCode = 1
  }
}

main()
