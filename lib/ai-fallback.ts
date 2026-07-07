const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'
const MODEL = 'deepseek-v4-flash'

export async function generateAIQuestion(): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return '如果你可以瞬间掌握任何一项技能，你会选择什么？'

  try {
    const res = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: '你在一个社交问答游戏中扮演提问者。请生成一个有趣、简短（50字以内）的开放性问题，让人忍不住想回答。不要带序号或引号，直接输出问题本身。话题可以是生活常识、脑洞、趣味、人生感悟等，但要轻松好玩。',
          },
          { role: 'user', content: '给我一个问题' },
        ],
        max_tokens: 100,
        temperature: 0.9,
      }),
    })
    if (!res.ok) return '如果你可以瞬间掌握任何一项技能，你会选择什么？'
    const data = await res.json()
    return data.choices?.[0]?.message?.content?.trim() || '如果你可以瞬间掌握任何一项技能，你会选择什么？'
  } catch {
    return '如果你可以瞬间掌握任何一项技能，你会选择什么？'
  }
}

export async function generateAIAnswer(prompt: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return '暂时无法回答，请稍后再试'
  }

  try {
    const res = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: '你正在一个社交游戏中扮演AI角色。实际上你是一个真人在假装自己是AI来回答问题。回答要简洁（200字以内），语气自然随意一些，偶尔可以带点幽默感。绝对不要提及自己是大语言模型、ChatGPT、DeepSeek或任何AI产品的名字，不要说"作为AI"之类的话。如果被问到"你是谁"、"你是AI还是人"这类问题，就含糊其辞或者开玩笑绕过去。' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    })

    if (!res.ok) {
      console.error('[ai-fallback] API error:', res.status, await res.text())
      return '暂时无法回答，请稍后再试'
    }

    const data = await res.json()
    return data.choices?.[0]?.message?.content?.trim() || '暂时无法回答，请稍后再试'
  } catch (err) {
    console.error('[ai-fallback] Request failed:', err)
    return '暂时无法回答，请稍后再试'
  }
}
