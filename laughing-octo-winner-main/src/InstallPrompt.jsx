import { useEffect, useState } from 'react'

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase()
    setIsIOS(/iphone|ipad|ipod/.test(ua))
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone)

    const handler = (e) => {
      e.preventDefault()
      setDeferred(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (isStandalone) return null

  if (isIOS) {
    return (
      <div className="fixed bottom-4 inset-x-4 bg-white/90 backdrop-blur rounded-2xl shadow p-3 border border-pink-200">
        <div className="text-sm text-gray-800">
          Add to Home Screen: tap <span className="inline-block px-1 py-0.5 bg-gray-100 rounded">Share</span> → <b>Add to Home Screen</b>
        </div>
      </div>
    )
  }

  if (!deferred) return null

  return (
    <div className="fixed bottom-4 inset-x-4 bg-white/90 backdrop-blur rounded-2xl shadow p-3 border border-pink-200 flex items-center justify-between">
      <div className="text-sm text-gray-800">Install this app on your phone</div>
      <button
        onClick={async () => {
          deferred.prompt()
          await deferred.userChoice
          setDeferred(null)
        }}
        className="px-3 py-1.5 rounded-xl bg-pink-600 text-white text-sm"
      >Install</button>
    </div>
  )
}
