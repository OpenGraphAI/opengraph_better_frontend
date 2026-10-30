# Scene memory for robots

A robot's camera sees thousands of frames during a single task, and most of what it saw is gone by the next step. OpenGraph Image turns those frames into a memory of objects, the places they were in, and how they related, all linked back to the frame that showed them, so a planning agent can query the graph instead of re-reading video.

## Relations built for manipulation
### The questions a manipulation task asks.

What is resting on the tray, whether anything is still inside the drawer, what sat next to the cutting board, whether the cup is blocked, what the gripper was holding: each maps onto one relation in the fixed vocabulary. Objects also carry color, material, and size, so a task can say "the blue cloth" instead of an opaque ID.

```visual:edges
@ ep07_step-030.jpg
cup | on_top_of | tray | 0.92
towel | inside | drawer | 0.84
knife | next_to | cutting board | 0.81
cloth | has_attribute | color: blue | 0.88
```

## See it on real robot data
### Sixteen frames from BridgeData V2, as a graph you can click through.

The [Robot Scene Memory sample](https://opengraphai.github.io/opengraph-samples-robot-scene-memory/) builds a graph from 16 robot-camera observations taken from BridgeData V2, a public robot-manipulation dataset, and publishes it as a read-only graph gallery. The [sample repository](https://github.com/OpenGraphAI/opengraph-samples-robot-scene-memory) includes the source data and the steps to reproduce it.

## A workflow you can run today
### Name frames in order, build the episode, give your agent the server.

OpenGraph does not read timestamps from image metadata, so put the episode and step in each filename, such as `ep07_step-015.jpg`. Then build the graph for the episode and register the MCP server.

```visual:terminal
$ pip install opengraph-image
$ opengraph-image build ./episode-07
$ claude mcp add opengraph-image -- opengraph-image-mcp
```

## Ask in plain language
### One lookup finds the object in every frame.

Objects with the same label merge into one node that lists every frame it was `seen_in`, so the agent finds the sponge in one step, follows its `inside` and `next_to` edges, and returns the frame filenames. The step numbers in those names tell the planner when each observation happened.

```visual:exchange
you: Using the graph for ./episode-07, which frames show the sponge inside the sink, and what was next to it?
-> query_graph(question, "./episode-07")
agent: ep07_step-015.jpg and ep07_step-030.jpg, with the dish brush next to it in both.
```

## Good to know

> **Not a control loop.** Every frame is a call to a hosted vision model. Use the graph for episodic memory, task review, and planning between actions, not for reactive control.

- **No identity tracking.** Objects merge by label: two identical cups become one `cup` node seen in both frames, and the graph does not know whether they are the same cup.
- **2D only.** Bounding boxes are optional and normalized to the image. There are no depth estimates, poses, or map coordinates.
- **One graph per folder.** Shared multi-robot memory is a direction, not a feature yet.

Working on robot memory and want to test this on your own episodes? [Talk to us](/#about).

## Go deeper
- [Quickstart](/docs/getting-started/quickstart/) — Install, build, and query the sample images
- [OpenGraph Image overview](/docs/opengraph-image/overview/) — Node types, relationships, and limits
- [MCP tools](/docs/reference/mcp-tools/) — Every tool's inputs and outputs
