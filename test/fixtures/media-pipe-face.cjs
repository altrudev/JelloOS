// Synthetic deterministic geometry in the actual 478-point MediaPipe topology.
// This is a contract fixture, not recorded model output or accuracy evidence.
exports.frame = () => {
  const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: -0.02 }));
  for (const [index, x, y] of [[468, 0.3, 0.4], [473, 0.7, 0.45]]) {
    points[index] = { x, y, z: -0.03 };
    [[0.01, 0], [0, -0.02], [-0.01, 0], [0, 0.02]].forEach(([dx, dy], offset) => {
      points[index + offset + 1] = { x: x + dx, y: y + dy, z: -0.03 };
    });
  }
  return {
    timestampMs: 1000,
    result: { faceLandmarks: [points], facialTransformationMatrixes: [{
      rows: 4, columns: 4, data: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    }] },
    quality: { left: { confidence: 0.95, openness: 0.5 }, right: { confidence: 0.96, openness: 0.6 } },
  };
};
