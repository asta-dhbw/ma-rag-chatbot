'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, FileText, File } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * MilvusResults - Display Milvus search results in a clean, expandable format
 *
 * @param {Object} props
 * @param {Array} props.results - Array of search results with metadata and content
 */
export default function MilvusResults({ results }) {
  if (!results || results.length === 0) {
    return (
      <div className="rounded-lg border border-muted/30 bg-[hsl(220,10%,10%)] p-4 text-center text-sm text-muted-foreground">
        No relevant documents found in the knowledge base.
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-2">
      {/* Results count header */}
      <div className="text-xs text-muted-foreground">
        Found {results.length} result{results.length !== 1 ? 's' : ''}
      </div>

      {/* Result items */}
      {results.map((result, index) => (
        <ResultItem key={index} result={result} index={index} />
      ))}
    </div>
  );
}

/**
 * ResultItem - Individual collapsible result card
 */
function ResultItem({ result, index }) {
  const [isOpen, setIsOpen] = useState(false);

  const isChunk = result.type === 'chunk';
  const score = Math.round(result.score * 100);
  const metadata = result.metadata || {};

  // Get color based on similarity score
  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 75) return 'text-yellow-400';
    return 'text-orange-400';
  };

  // Extract a clean page label. local_page_num is sometimes the full id
  // (e.g. "Infos_Studium_DataScience_DHBW_page_1") - reduce it to just the number.
  const extractPageNumber = (value) => {
    if (value === undefined || value === null) return null;
    const str = String(value);
    const match = str.match(/page[_-]?(\d+)/i);
    if (match) return match[1];
    if (/^\d+$/.test(str)) return str;
    return str;
  };

  const pageLabel =
    extractPageNumber(metadata.page) ??
    extractPageNumber(metadata.local_page_num);

  const displayName = metadata.filename || metadata.file_id || 'Unknown';

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="w-full min-w-0 overflow-hidden rounded-lg border border-muted/30 bg-[hsl(220,10%,10%)] shadow-sm">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[hsl(220,10%,12%)] transition-colors"
          >
            {/* Left side: Icon + Metadata */}
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              {/* Expand/collapse icon */}
              <div className="shrink-0 text-muted-foreground">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>

              {/* Similarity Score */}
              <div
                className={cn(
                  'shrink-0 text-sm font-semibold tabular-nums',
                  getScoreColor(score)
                )}
              >
                {score}%
              </div>

              {/* File & Page Info */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="shrink-0 text-muted-foreground">
                  {isChunk ? (
                    <FileText className="h-4 w-4" />
                  ) : (
                    <File className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  <span className="truncate">{displayName}</span>
                  {pageLabel && (
                    <span className="text-muted-foreground/70">
                      {' · '}S. {pageLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right side: Badges */}
            <div className="flex shrink-0 items-center gap-2">
              {metadata.location && (
                <Badge
                  variant="secondary"
                  className="hidden sm:inline-flex bg-[hsl(220,10%,14%)] text-[11px] text-muted-foreground"
                >
                  {metadata.location}
                </Badge>
              )}
              <Badge
                variant="outline"
                className="border-muted/40 text-[11px]"
              >
                {isChunk ? 'Chunk' : 'Page'}
              </Badge>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Separator className="bg-muted/30" />
          <div className="space-y-3 px-4 py-3">
            {/* Metadata Section */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-white">Metadata</div>
              <div className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
                {metadata.filename && (
                  <MetadataItem label="Filename" value={metadata.filename} />
                )}
                {metadata.file_id && (
                  <MetadataItem label="File ID" value={metadata.file_id} />
                )}
                {pageLabel && (
                  <MetadataItem label="Page" value={pageLabel} />
                )}
                {metadata.location && (
                  <MetadataItem label="Location" value={metadata.location} />
                )}
                {metadata.chunk_index !== undefined && (
                  <MetadataItem label="Chunk Index" value={metadata.chunk_index} />
                )}
                {metadata.page_id && (
                  <MetadataItem label="Page ID" value={metadata.page_id} />
                )}
              </div>
            </div>

            <Separator className="bg-muted/20" />

            {/* Content Section */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-white">
                {isChunk ? 'Chunk Content' : 'Page Summary'}
              </div>
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {result.content || 'No content available'}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/**
 * MetadataItem - Simple key-value display for metadata
 */
function MetadataItem({ label, value }) {
  return (
    <div className="min-w-0 text-muted-foreground">
      <span className="text-white/70">{label}:</span>{' '}
      <span className="break-all">{value}</span>
    </div>
  );
}
