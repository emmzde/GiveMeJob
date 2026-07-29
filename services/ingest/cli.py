from __future__ import annotations

import argparse
import asyncio
import json
from collections.abc import Sequence
from pathlib import Path

from services.api.config import Settings, get_settings
from services.ingest.connectors import (
    AdzunaConnector,
    ArbeitnowConnector,
    HimalayasConnector,
    JobicyConnector,
    JoobleConnector,
    RemotiveConnector,
)
from services.ingest.connectors.base import Connector
from services.ingest.embeddings import EmbeddingService
from services.ingest.http import ConnectorRequestError, PoliteHttpClient
from services.ingest.normalize.currency import ExchangeRateClient
from services.ingest.normalize.pipeline import JobNormalizer
from services.ingest.normalize.salary import SalaryNormalizer
from services.ingest.normalize.skills import SkillDefinition, SkillMatcher
from services.ingest.pipeline import PERSISTENCE_BATCH_MIN, IngestionPipeline
from services.ingest.progress import ProgressReporter
from services.ingest.registry import ATSProvider, connector_for, load_ats_registry
from services.ingest.repository import IngestionRepository
from services.ingest.skills.esco import (
    ESCOClient,
    ESCOResolutionError,
    load_canonical_overrides,
    load_skill_queries,
)


def _public_connector(name: str, http: PoliteHttpClient, settings: Settings) -> Connector:
    if name == "himalayas":
        return HimalayasConnector(http)
    if name == "arbeitnow":
        return ArbeitnowConnector(http)
    if name == "remotive":
        return RemotiveConnector(http)
    if name == "jobicy":
        return JobicyConnector(http)
    if name == "adzuna":
        if not settings.adzuna_app_id or not settings.adzuna_app_key:
            raise ValueError("ADZUNA_APP_ID and ADZUNA_APP_KEY are required")
        return AdzunaConnector(
            http,
            app_id=settings.adzuna_app_id,
            app_key=settings.adzuna_app_key,
        )
    if name == "jooble":
        if not settings.jooble_api_key:
            raise ValueError("JOOBLE_API_KEY is required")
        return JoobleConnector(http, api_key=settings.jooble_api_key)
    raise ValueError(f"unknown connector: {name}")


async def _build_pipeline(
    settings: Settings,
    http: PoliteHttpClient,
    repository: IngestionRepository,
    *,
    batch_size: int,
) -> IngestionPipeline:
    skills = repository.load_skills()
    if not skills:
        raise RuntimeError("ESCO skill catalog is empty; run seed-skills first")
    rates = await ExchangeRateClient(http).latest_to_usd()
    normalizer = JobNormalizer(
        SkillMatcher(skills),
        SalaryNormalizer(rates.rates_to_usd),
    )
    embeddings = EmbeddingService(
        settings.embedding_model,
        cache_dir=settings.embedding_cache_dir,
    )
    return IngestionPipeline(
        normalizer,
        repository,
        embeddings,
        batch_size=batch_size,
    )


async def seed_skills(settings: Settings) -> dict[str, object]:
    queries = load_skill_queries(Path("config/esco_skill_queries.json"))
    overrides = load_canonical_overrides(Path("config/esco_canonical_overrides.json"))
    resolved: list[SkillDefinition] = []
    failures: list[dict[str, str]] = []
    async with PoliteHttpClient(user_agent=settings.source_user_agent) as http:
        client = ESCOClient(http)
        with ProgressReporter("seed-skills", total=len(queries)) as progress:
            for processed, (query, aliases) in enumerate(queries.items(), start=1):
                try:
                    resolved.append(
                        await client.resolve(
                            query,
                            aliases,
                            expected_title=overrides.get(query),
                        )
                    )
                except (ESCOResolutionError, ConnectorRequestError, ValueError) as exc:
                    failures.append({"query": query, "error": str(exc)})
                finally:
                    progress.update(processed)
    with IngestionRepository(settings.database_url) as repository:
        saved = repository.seed_skills(resolved)
        pruned = repository.prune_unreferenced_skills(
            [definition.esco_uri for definition in resolved]
        )
    return {
        "requested": len(queries),
        "resolved": len(resolved),
        "saved": saved,
        "pruned": pruned,
        "failures": failures,
    }


async def run_public(
    settings: Settings,
    *,
    name: str,
    limit: int | None,
    embed: bool,
    batch_size: int,
) -> dict[str, object]:
    async with PoliteHttpClient(user_agent=settings.source_user_agent) as http:
        connector = _public_connector(name, http, settings)
        with IngestionRepository(settings.database_url) as repository:
            pipeline = await _build_pipeline(
                settings,
                http,
                repository,
                batch_size=batch_size,
            )
            result = await pipeline.run_connector(connector, limit=limit, embed=embed)
    return result.model_dump(mode="json")


async def run_ats(
    settings: Settings,
    *,
    provider: ATSProvider | None,
    limit_companies: int | None,
    embed: bool,
    batch_size: int,
) -> dict[str, object]:
    registry = load_ats_registry(Path("config/ats_companies.json"))
    entries = [
        entry for entry in registry.entries() if provider is None or entry.provider is provider
    ]
    if limit_companies is not None:
        entries = entries[:limit_companies]

    results: list[dict[str, object]] = []
    failures: list[dict[str, str]] = []
    total_fetched = 0
    total_saved = 0
    async with PoliteHttpClient(user_agent=settings.source_user_agent) as http:
        with IngestionRepository(settings.database_url) as repository:
            pipeline = await _build_pipeline(
                settings,
                http,
                repository,
                batch_size=batch_size,
            )
            with ProgressReporter("ats-companies", total=len(entries)) as progress:
                for processed, entry in enumerate(entries, start=1):
                    connector = connector_for(entry, http)
                    try:
                        result = await pipeline.run_connector(connector, embed=embed)
                        results.append(
                            {
                                "provider": entry.provider.value,
                                "company_slug": entry.company_slug,
                                **result.model_dump(mode="json"),
                            }
                        )
                        total_fetched += result.fetched
                        total_saved += result.saved
                    except (ConnectorRequestError, ValueError) as exc:
                        failures.append(
                            {
                                "provider": entry.provider.value,
                                "company_slug": entry.company_slug,
                                "error": str(exc),
                            }
                        )
                    finally:
                        progress.update(processed)
    return {
        "companies": len(entries),
        "succeeded": len(results),
        "failed": len(failures),
        "fetched": total_fetched,
        "saved": total_saved,
        "failures": failures,
    }


def backfill_embeddings(
    settings: Settings,
    *,
    batch_size: int,
    limit: int | None,
) -> dict[str, object]:
    service = EmbeddingService(
        settings.embedding_model,
        cache_dir=settings.embedding_cache_dir,
    )
    updated = 0
    with (
        ProgressReporter("backfill-embeddings", total=limit) as progress,
        IngestionRepository(settings.database_url) as repository,
    ):
        while limit is None or updated < limit:
            remaining = batch_size if limit is None else min(batch_size, limit - updated)
            rows = repository.jobs_without_embeddings(limit=remaining)
            if not rows:
                break
            vectors = service.embed_passages(
                [text for _, text in rows],
                batch_size=batch_size,
            )
            updated += repository.backfill_embeddings(
                (job_id, vector) for (job_id, _), vector in zip(rows, vectors, strict=True)
            )
            progress.update(updated)
    return {"updated": updated}


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m services.ingest.cli")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("seed-skills")

    run_parser = subparsers.add_parser("run")
    run_parser.add_argument(
        "--connector",
        required=True,
        choices=["adzuna", "jooble", "himalayas", "arbeitnow", "remotive", "jobicy"],
    )
    run_parser.add_argument("--limit", type=int)
    run_parser.add_argument("--batch-size", type=int, default=PERSISTENCE_BATCH_MIN)
    run_parser.add_argument("--no-embed", action="store_true")

    ats_parser = subparsers.add_parser("run-ats")
    ats_parser.add_argument("--provider", choices=[provider.value for provider in ATSProvider])
    ats_parser.add_argument("--limit-companies", type=int)
    ats_parser.add_argument("--batch-size", type=int, default=PERSISTENCE_BATCH_MIN)
    ats_parser.add_argument("--no-embed", action="store_true")

    embedding_parser = subparsers.add_parser("backfill-embeddings")
    embedding_parser.add_argument("--batch-size", type=int, default=32)
    embedding_parser.add_argument("--limit", type=int)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    settings = get_settings()
    result: dict[str, object]
    if args.command == "seed-skills":
        result = asyncio.run(seed_skills(settings))
    elif args.command == "run":
        result = asyncio.run(
            run_public(
                settings,
                name=str(args.connector),
                limit=args.limit,
                embed=not args.no_embed,
                batch_size=int(args.batch_size),
            )
        )
    elif args.command == "run-ats":
        provider = ATSProvider(args.provider) if args.provider else None
        result = asyncio.run(
            run_ats(
                settings,
                provider=provider,
                limit_companies=args.limit_companies,
                embed=not args.no_embed,
                batch_size=int(args.batch_size),
            )
        )
    else:
        result = backfill_embeddings(
            settings,
            batch_size=int(args.batch_size),
            limit=args.limit,
        )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
