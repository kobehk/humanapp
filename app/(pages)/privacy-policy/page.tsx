import Link from 'next/link'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white p-8 max-w-2xl mx-auto">
      <div className="border border-gray-200 rounded-2xl p-8">
        <Link href="/" className="text-purple-600 underline text-sm">返回</Link>

        <h1 className="text-5xl font-black mt-6 mb-2" style={{ fontFamily: 'cursive' }}>
          隐私政策
        </h1>
        <p className="text-gray-400 text-sm mb-8">生效日期：2026 年 7 月 5 日</p>

        <h2 className="text-xl font-bold mb-2">简短说明</h2>
        <p className="text-gray-600 mb-8">
          假扮 AI 无需注册账号，接近匿名使用。我们仅在您被限制使用时存储您的 IP 地址。未被举报/标记的内容不会保存超过一小时。
        </p>

        <h2 className="text-xl font-bold mb-3">我们收集的信息</h2>
        <ul className="space-y-4 mb-8">
          {[
            { title: '设备指纹', body: '由浏览器本地生成并存储。用于保持会话一致性和执行审核措施。' },
            { title: 'IP 地址', body: '用于限速和封禁执行。' },
            { title: '用户 ID', body: '浏览器随机生成并本地存储的随机 ID。用于积分和游戏状态。' },
            { title: '用户提交的内容', body: '您通过游戏发送的提问、文字回答和图片。' },
          ].map(({ title, body }) => (
            <li key={title} className="text-gray-600">
              <strong className="text-gray-900">{title}：</strong>{body}
            </li>
          ))}
        </ul>
        <p className="text-gray-500 text-sm mb-8">以上数据均不与您的真实身份挂钩。我们不要求您提供姓名或任何个人信息。</p>

        <h2 className="text-xl font-bold mb-2">使用方式</h2>
        <p className="text-gray-600 mb-8">
          用于运营游戏：分发提问和回答、追踪积分、内容审核以及限速处理。
        </p>

        <h2 className="text-xl font-bold mb-2">第三方服务</h2>
        <p className="text-gray-600 mb-8">
          我们自托管字体，并使用 Google Fonts 作为备用字体来源，使用 Cloudflare Turnstile 进行机器人/垃圾内容防护，使用 OpenPanel 进行数据分析。Turnstile 和 OpenPanel 会在您的浏览器中设置 Cookie。
          <br /><br />
          任何用户内容或身份识别信息均不会与任何第三方服务共享。
        </p>

        <h2 className="text-xl font-bold mb-2">数据保留</h2>
        <p className="text-gray-600 mb-8">
          大多数游戏数据不会保留超过一小时。仅当提问或回答被举报和/或被系统标记时才会留存。被限制用户的 IP 地址和设备指纹将被无限期保留，以防止进一步滥用。
        </p>

        <h2 className="text-xl font-bold mb-2">未成年人</h2>
        <p className="text-gray-600 mb-8">
          本网站不面向 13 岁以下用户。我们不会在知情情况下收集 13 岁以下儿童的数据。如果您认为有 13 岁以下儿童使用了本网站，请联系我们，我们将采取相应措施。
        </p>

        <hr className="border-dashed border-gray-300 mb-6" />

        <p className="text-gray-500 text-sm">
          有疑问？请发送邮件至{' '}
          <a href="mailto:hi@humanapp.app" className="text-purple-600 underline">hi@humanapp.app</a>。
        </p>
      </div>
    </div>
  )
}
