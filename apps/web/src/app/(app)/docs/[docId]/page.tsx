import { DocEditor } from '@/components/editor/DocEditor'

interface Props {
  params: Promise<{ docId: string }>
}

export default async function DocPage({ params }: Props) {
  const { docId } = await params
  return <DocEditor docId={docId} />
}
