import type { JSX } from 'react';
import type { TOCItemType } from "fumadocs-core/toc";
import defaultMdxComponents from "fumadocs-ui/mdx";
import {
	DocsBody,
	DocsDescription,
	DocsPage,
	DocsTitle,
} from "fumadocs-ui/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { source } from "@/lib/source";

type DocsMdxComponent = (props: {
	components?: Record<string, unknown>;
}) => JSX.Element;

type DocsRuntimePageData = {
	title?: string;
	description?: string;
	body?: DocsMdxComponent;
	toc?: TOCItemType[];
	full?: boolean;
};

export default async function Page(props: {
	params: Promise<{ slug?: string[] }>;
}) {
	const params = await props.params;
	const page = source.getPage(params.slug);
	if (!page) notFound();

	const pageData = page.data as unknown as DocsRuntimePageData;
	const MDX = pageData.body;
	if (!MDX) notFound();

	return (
		<DocsPage toc={pageData.toc} full={pageData.full}>
			<DocsTitle>{pageData.title}</DocsTitle>
			{pageData.description && (
				<DocsDescription>{pageData.description}</DocsDescription>
			)}
			<DocsBody>
				<MDX components={{ ...defaultMdxComponents }} />
			</DocsBody>
		</DocsPage>
	);
}

export function generateStaticParams() {
	return source.generateParams();
}

export async function generateMetadata(props: {
	params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
	const params = await props.params;
	const page = source.getPage(params.slug);
	if (!page) return {};

	return {
		title: `${page.data.title} | Aether Docs`,
		description: page.data.description ?? "Aether developer documentation.",
	};
}
