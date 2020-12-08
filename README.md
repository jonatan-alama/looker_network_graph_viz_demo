# Demonstration of Network Graph visualization for Looker

Created for Looker Hack@Home 2020 hackathon.

Demonstrates how to link a [custom looker visualization](https://github.com/looker/custom_visualizations_v2/blob/master/docs/getting_started.md) with an external application created using the [Looker Extension Framework](https://docs.looker.com/data-modeling/extension-framework/extension-framework-intro) in order to increase the query limit and possibly show extra information.

## Packages

### network-graph-viz

An example of a network graph created using the Looker Visualization API and [visjs](https://visjs.github.io/vis-network/examples/).

It shows a link in the lower left that opens the network-graph-app.

### network-graph-app

An example of a application created using the Extension Framework. Given a query slug, it will show the same network graph as in the network-graph-viz, but with bigger viewport and query limit.
