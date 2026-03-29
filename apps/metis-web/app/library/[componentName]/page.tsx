import { NyxComponentDetailPage } from "@/components/library/nyx-component-detail-page";

interface LibraryComponentPageProps {
  params: Promise<{
    componentName: string;
  }>;
}

export default async function LibraryComponentPage({
  params,
}: LibraryComponentPageProps) {
  const { componentName } = await params;

  return <NyxComponentDetailPage componentName={componentName} />;
}