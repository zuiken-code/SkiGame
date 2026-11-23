CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  name TEXT,
  distance INTEGER CHECK (distance >= 0)
);
CREATE INDEX runs_by_start ON runs (started_at);

CREATE TABLE best_scores (
  player_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  distance INTEGER NOT NULL CHECK (distance >= 0),
  achieved_at INTEGER NOT NULL
);
CREATE INDEX best_scores_by_distance
  ON best_scores (distance DESC, achieved_at ASC, player_id ASC);

-- Finishing a run and updating the personal best are one atomic write.
CREATE TRIGGER record_finished_run AFTER UPDATE OF finished_at ON runs
WHEN OLD.finished_at IS NULL AND NEW.finished_at IS NOT NULL
BEGIN
  INSERT INTO best_scores (player_id, name, distance, achieved_at)
    VALUES (NEW.player_id, NEW.name, NEW.distance, NEW.finished_at)
  ON CONFLICT (player_id) DO UPDATE SET
    name = excluded.name,
    distance = MAX(best_scores.distance, excluded.distance),
    achieved_at = CASE WHEN excluded.distance > best_scores.distance
      THEN excluded.achieved_at ELSE best_scores.achieved_at END
  WHERE excluded.distance > best_scores.distance OR excluded.name <> best_scores.name;
END;
