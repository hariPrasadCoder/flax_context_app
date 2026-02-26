import { AppShell } from '@/components/layout/AppShell'
import { DocEditor } from '@/components/editor/DocEditor'

interface Props {
  params: Promise<{ docId: string }>
}

export default async function DocPage({ params }: Props) {
  const { docId } = await params

  return (
    <AppShell>
      <DocEditor docId={docId} />
    </AppShell>
  )
}
