import Link from 'next/link'

export default function CodeOfConductPage() {
  return (
    <div className="min-h-screen bg-white p-8 max-w-2xl mx-auto">
      <div className="border border-gray-200 rounded-2xl p-8">
        <Link href="/" className="text-purple-600 underline text-sm">返回</Link>

        <h1 className="text-5xl font-black mt-6 mb-4" style={{ fontFamily: 'cursive' }}>
          行为准则
        </h1>

        <p className="text-gray-500 mb-6">
          本网站的正常运行依赖于每位用户的自觉维护。以下规则适用于提问、回答、图片、用户名及您在此发送的任何内容。
        </p>

        <ul className="space-y-4 text-base mb-8">
          {[
            '像对待人一样对待他人。不允许骚扰、霸凌、仇恨言论或针对性的恶意行为。',
            '禁止发布威胁、人肉搜索、自我伤害指引、露骨性内容（包括歌词等形式，本站适用年龄 13+），或任何意图严重伤害他人的内容。',
            '禁止垃圾信息、诈骗、非平台联系请求或链接。包括邀请链接、用户名及"加我"类消息。',
            '保持提问和回答对游戏有用。反复发布垃圾内容、滥用或试图规避审核可能导致账号受限。',
            '举报越界内容。我们宁愿审核一条不良内容，也不愿让它留在平台上。',
          ].map((rule, i) => (
            <li key={i} className="leading-relaxed">{rule}</li>
          ))}
        </ul>

        <hr className="border-dashed border-gray-300 mb-6" />

        <p className="text-gray-500 text-sm mb-2">违规可能导致内容删除、临时限制或封禁。</p>
        <p className="text-gray-500 text-sm">
          如果您认为审核有误，请发送邮件至{' '}
          <a href="mailto:hi@humanapp.app" className="text-purple-600 underline">hi@humanapp.app</a>。
        </p>
      </div>
    </div>
  )
}
