const glados = async () => {
  const notice = []
  if (!process.env.GLADOS) return
  for (const cookie of String(process.env.GLADOS).split('\n')) {
    if (!cookie) continue
    try {
      const common = {
        cookie,
        referer: 'https://glados.cloud/console/checkin',
        'user-agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)',
      }
      const action = await fetch('https://glados.cloud/api/user/checkin', {
        method: 'POST',
        headers: { ...common, 'content-type': 'application/json' },
        body: '{"token":"glados.cloud"}',
      }).then(r => r.json())
      if (action?.code) throw new Error(action?.message)
      const status = await fetch('https://glados.cloud/api/user/status', {
        method: 'GET',
        headers: { ...common },
      }).then(r => r.json())
      if (status?.code) throw new Error(status?.message)
      notice.push(
        'Checkin OK',
        `${action?.message}`,
        `Left Days ${Number(status?.data?.leftDays)}`
      )
    } catch (error) {
      notice.push(
        'Checkin Error',
        `${error}`,
        `<${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}>`
      )
    }
  }
  return notice
}

const notify = async (notice) => {
  if (!process.env.NOTIFY || !notice) return
  for (const option of String(process.env.NOTIFY).split('\n')) {
    if (!option) continue
    try {
      if (option.startsWith('pushplus:')) {
        const token = option.split(':')[1]
        const res = await fetch('https://www.pushplus.plus/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            token,
            title: notice[0],
            content: notice.join('<br>'),
            template: 'markdown',
          }),
        }).then(r => r.json())
        console.log("Pushplus result:", res)
      }
    } catch (error) {
      console.error("Push failed:", error)
    }
  }
}

const main = async () => {
  try {
    const notice = await glados()
    if (!notice || notice.length === 0) {
      console.log("No checkin notice to send")
      return
    }
    console.log("Sending notice:", notice)
    await notify(notice)
    console.log("Push finished")
  } catch (err) {
    console.error("Unexpected error:", err)
  }
}

main()
