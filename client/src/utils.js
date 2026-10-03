export function topicToId(topic) {
  if (!topic) return "";
  return topic.trim().toLowerCase().replace(/\s+/g, "-");
}

export function findMatchingRoadmap(savedRoadmaps, id) {
  if (!id || !savedRoadmaps || savedRoadmaps.length === 0) return null;
  const decoded = decodeURIComponent(id).trim().toLowerCase();
  return savedRoadmaps.find((r) => {
    const rTopic = r.topic.trim().toLowerCase();
    const rId = topicToId(r.topic);
    return (
      rTopic === decoded ||
      rId === decoded ||
      rTopic.replace(/\s+/g, "-") === decoded.replace(/\s+/g, "-")
    );
  }) || null;
}
