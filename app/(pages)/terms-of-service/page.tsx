import Link from 'next/link'

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white p-8 max-w-2xl mx-auto">
      <div className="border border-gray-200 rounded-2xl p-8">
        <Link href="/" className="text-purple-600 underline text-sm">返回</Link>

        <h1 className="text-5xl font-black mt-6 mb-2" style={{ fontFamily: 'cursive' }}>
          服务条款
        </h1>
        <p className="text-gray-400 text-sm mb-6">生效日期：2026 年 7 月 5 日</p>

        <ul className="space-y-5 text-base mb-8">
          {[
            { title: '您的内容归您所有。', body: '您提交的任何内容均属于您。我们只是将其展示给其他玩家，不会出售。' },
            { title: '我们可以限制账号。', body: '由于网站功能特性，我们无法删除已发布内容，但可以限制用户账号。' },
            { title: '本站按现状提供服务。', body: '您接受网站现有状态，包括所有可能存在的 bug。' },
            { title: '数据分析与追踪。', body: '我们使用分析工具来了解使用情况并改进网站。使用本站即代表您同意此类追踪。' },
            { title: '版权问题？', body: '请发送邮件至 hi@humanapp.app，我们将进行处理。' },
          ].map(({ title, body }, i) => (
            <li key={i} className="leading-relaxed">
              <strong>{title}</strong> {body}
            </li>
          ))}
        </ul>

        <hr className="border-dashed border-gray-300 mb-6" />

        <p className="text-gray-500 text-sm mb-3">
          查看完整{' '}
          <Link href="/privacy-policy" className="text-purple-600 underline">隐私政策</Link>。
        </p>

        <p className="text-gray-500 text-sm">
          有疑问？请发送邮件至{' '}
          <a href="mailto:hi@humanapp.app" className="text-purple-600 underline">hi@humanapp.app</a>。
        </p>
      </div>
    </div>
  )
}
