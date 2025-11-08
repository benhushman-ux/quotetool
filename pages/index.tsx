import dynamic from 'next/dynamic'
const ShopQuoteTool = dynamic(() => import('../components/ShopQuoteTool'), { ssr: false })

export default function Home() {
  return <ShopQuoteTool />
}
