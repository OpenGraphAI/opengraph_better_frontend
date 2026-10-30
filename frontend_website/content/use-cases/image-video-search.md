# Search images by relationship

Keyword search can find every photo tagged person and every photo tagged umbrella. It cannot tell you which ones show a person holding the umbrella, rather than standing near a closed one in a stand. OpenGraph Image records the relationship itself, so a query matches on structure instead of wording.

## From tags to relationships
### Match the arrangement, not the words.

Tags and captions return any image that mentions both things, in any arrangement. A graph query matches the edge itself, along with scene labels, text read from inside the image, and attributes like color and material. Because relations and attribute keys come from fixed vocabularies, the same question matches the same way across the whole collection.

```visual:edges
@ office-02.jpg
laptop | on_top_of | desk | 0.94
office-02.jpg | in_scene | indoor_commercial | 0.96
mug | has_attribute | color: red | 0.89
mug | has_attribute | material: ceramic | 0.84
```

## Search from your agent
### Build once, then ask in plain language.

Build a graph of the folder and register the MCP server, and any MCP-compatible agent can search it. Asking for everything extracted from one file calls `get_image_entities`, the quickest way to check why an image matched before you rely on it.

```visual:exchange
you: Show everything extracted from street-14.jpg.
-> get_image_entities("street-14.jpg", "./photos")
agent: A person, an umbrella, a bicycle, and a building in an outdoor scene, the text "EXIT", and how each object relates to the others.
```

## Video
### Sample frames today, then search them.

OpenGraph Image reads still images, not video files. Sample one frame per second into a folder and the frame number tells you where to look: numbering starts at 1, so `t00042.jpg` is roughly the 41-second mark. Raise the rate for fast-moving scenes, or lower it to keep builds cheap on long recordings. Native video support, including events that unfold across frames, is not part of the current release.

```visual:terminal
$ mkdir frames
$ ffmpeg -i site-walkthrough.mp4 -vf fps=1 frames/t%05d.jpg
$ opengraph-image build ./frames
```

## Good fits
### Where the arrangement is the question.

- Product and catalog photography, where buyers ask for arrangements ("a sofa next to a floor lamp")
- Field inspection and site photos, where the question is what sits on, inside, or behind what
- Recorded demos and walkthroughs, sampled into frames and searched by what appears on screen

## Good to know

> **Images are sent to a hosted model during the build.** Do not process footage you are not permitted to share with your model provider.

- **Each image is a model call.** Build cost and time scale with the size of the collection, so sample video frames sparingly.
- **Fixed vocabularies cut both ways.** Matching is consistent, but a relation outside the set, such as "leaning against", is not recorded.
- **No identity across frames.** The graph knows a car appears in 40 frames, not whether it is the same car.

## Go deeper
- [Quickstart](/docs/getting-started/quickstart/) — Install, build, and query the sample images
- [OpenGraph Image overview](/docs/opengraph-image/overview/) — Node types, relationships, and limits
- [MCP tools](/docs/reference/mcp-tools/) — Every tool's inputs and outputs
- [CLI](/docs/reference/cli/) — Build, summary, and query commands
