'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
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
    <div className="space-y-2">
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

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-muted/30 bg-[hsl(220,10%,10%)] shadow-sm">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer px-4 py-3 hover:bg-[hsl(220,10%,12%)] transition-colors">
            <div className="flex items-center justify-between gap-3">
              {/* Left side: Icon + Metadata */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Expand/collapse icon */}
                <div className="text-muted-foreground">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </div>

                {/* Similarity Score */}
                <div className={cn('text-sm font-semibold tabular-nums', getScoreColor(score))}>
                  {score}%
                </div>

                {/* File & Page Info */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="text-muted-foreground">
                    {isChunk ? (
                      <FileText className="h-4 w-4" />
                    ) : (
                      <File className="h-4 w-4" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {metadata.filename || metadata.file_id || 'Unknown'}
                    {metadata.page && ` · Page ${metadata.page}`}
                    {metadata.local_page_num && ` · Page ${metadata.local_page_num}`}
                  </div>
                </div>
              </div>

              {/* Right side: Badges */}
              <div className="flex items-center gap-2">
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
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Separator className="bg-muted/30" />
          <CardContent className="px-4 py-3 space-y-3">
            {/* Metadata Section */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-white">Metadata</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                {metadata.filename && (
                  <MetadataItem label="Filename" value={metadata.filename} />
                )}
                {metadata.file_id && (
                  <MetadataItem label="File ID" value={metadata.file_id} />
                )}
                {(metadata.page || metadata.local_page_num) && (
                  <MetadataItem
                    label="Page"
                    value={metadata.page || metadata.local_page_num}
                  />
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
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/**
 * MetadataItem - Simple key-value display for metadata
 */
function MetadataItem({ label, value }) {
  return (
    <div className="text-muted-foreground">
      <span className="text-white/70">{label}:</span> {value}
    </div>
  );
}
