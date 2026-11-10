"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { ReviewStars } from "@/components/ReviewStars";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import type { GenericReview } from "@/lib/types";
import { cn } from "@/lib/utils";

type StarFilter = 0 | 1 | 2 | 3 | 4 | 5;
type SortKey = "recent" | "highest" | "lowest";

function initials(name: string) {
  const parts = name.replace(/[^a-zA-Z ]/g, " ").trim().split(/\s+/);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "");
  return letters.join("") || "S";
}

export function ReviewsBoard({
  reviews,
  locale,
}: {
  reviews: GenericReview[];
  locale: string;
}) {
  const [starFilter, setStarFilter] = useState<StarFilter>(0);
  const [sort, setSort] = useState<SortKey>("recent");

  const counts = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0, 0];
    for (const review of reviews) {
      const star = Math.min(5, Math.max(1, Math.round(review.rating)));
      buckets[star] += 1;
    }
    return buckets;
  }, [reviews]);
  const total = reviews.length;
  const average =
    total > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / total
      : 0;
  const recommend =
    total > 0
      ? Math.round(
          (reviews.filter((review) => review.rating >= 4).length / total) * 100,
        )
      : 0;

  const visible = useMemo(() => {
    const filtered =
      starFilter === 0
        ? reviews
        : reviews.filter(
            (review) => Math.round(review.rating) === starFilter,
          );
    return [...filtered].sort((a, b) => {
      if (sort === "highest") return b.rating - a.rating;
      if (sort === "lowest") return a.rating - b.rating;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [reviews, starFilter, sort]);

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[220px_1fr] lg:items-center">
          <div className="space-y-3 text-center lg:text-left">
            <p className="text-sm text-muted-foreground">Overall rating</p>
            <p className="font-display text-6xl tabular-nums tracking-tight">
              {average.toFixed(1)}
            </p>
            <ReviewStars rating={average} size="lg" />
            <p className="text-sm text-muted-foreground">
              {total} reviews from 50 states
            </p>
            <p className="text-sm font-medium">
              {recommend}% of these shoppers recommend Plorix
            </p>
          </div>

          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = counts[star] || 0;
              const percent = total ? Math.round((count / total) * 100) : 0;
              const active = starFilter === star;
              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => setStarFilter(active ? 0 : (star as StarFilter))}
                  className={cn(
                    "grid w-full grid-cols-[4.5rem_1fr_3rem] items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm transition-colors",
                    active ? "bg-muted" : "hover:bg-muted/60",
                  )}
                  aria-pressed={active}
                  aria-label={`Filter ${star} star reviews, ${count} reviews`}
                >
                  <span className="tabular-nums text-muted-foreground">
                    {star} star
                  </span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-amber-400"
                      style={{ width: `${percent}%` }}
                    />
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground">
                    {percent}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              [0, "All notes"],
              [5, "5 star"],
              [4, "4 star"],
              [3, "3 star"],
              [2, "2 star"],
              [1, "1 star"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={label}
              type="button"
              size="sm"
              variant={starFilter === value ? "default" : "outline"}
              onClick={() => setStarFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Sort
          <select
            className="h-9 rounded-xl border border-border bg-background px-3 text-foreground"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
          >
            <option value="recent">Most recent</option>
            <option value="highest">Highest rated</option>
            <option value="lowest">Lowest rated</option>
          </select>
        </label>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {visible.length} of {total}
      </p>

      {visible.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border px-6 py-16 text-center">
          <p className="font-medium">No reviews in this filter</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try another star rating or show all reviews.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-5"
            onClick={() => setStarFilter(0)}
          >
            Show all reviews
          </Button>
        </div>
      ) : (
        <ul className="space-y-4">
          {visible.map((review) => {
            const dateLabel = review.date
              ? new Date(review.date).toLocaleDateString(locale, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "";
            return (
              <li key={`${review.reviewer}-${review.date}`}>
                <article className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
                  <div className="flex gap-4">
                    <div
                      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium"
                      aria-hidden
                    >
                      {initials(review.reviewer)}
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="font-medium">{review.reviewer}</p>
                        {review.verified ? (
                          <Badge variant="secondary" className="gap-1">
                            <BadgeCheck className="size-3" aria-hidden />
                            Verified purchase
                          </Badge>
                        ) : null}
                        {review.location ? (
                          <span className="text-sm text-muted-foreground">
                            {review.location}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <ReviewStars rating={review.rating} />
                        {dateLabel ? (
                          <time
                            dateTime={review.date}
                            className="text-sm text-muted-foreground"
                          >
                            {dateLabel}
                          </time>
                        ) : null}
                      </div>
                      {review.title ? (
                        <h2 className="text-base font-medium tracking-tight">
                          {review.title}
                        </h2>
                      ) : null}
                      <p className="max-w-prose text-pretty leading-relaxed text-muted-foreground">
                        {review.content}
                      </p>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-3xl border border-border bg-muted/40 px-6 py-8 text-center">
        <p className="font-display text-2xl">Shop the catalog</p>
        <p className="mx-auto mt-2 max-w-md text-pretty text-sm text-muted-foreground">
          These Plorix notes come from shoppers in cities across the United States.
        </p>
        <Link
          href="/products"
          className={cn(buttonVariants({ size: "lg" }), "mt-5")}
        >
          Browse products
        </Link>
      </div>
    </div>
  );
}
