import { ComponentsProvider, Link, Spinner } from "@looker/components";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import * as ReactDOM from "react-dom";
import { Network } from "vis-network/standalone";
import { Looker, VisConfig, VisData, VisOptions, VisualizationDefinition } from '../common/types';
import { handleErrors } from '../common/utils';
import './network-graph.scss';

declare var looker: Looker;

interface NetworkGraphViz extends VisualizationDefinition {
  elementRef?: HTMLDivElement,
}

const options = {
  autoResize: true,
  height: "100%",
  width: "100%",
  physics: {
    enabled: true,
    forceAtlas2Based: {
      gravitationalConstant: -26,
      centralGravity: 0.005,
      springLength: 230,
      springConstant: 0.03,
    },
    maxVelocity: 50,
    minVelocity: 1,
    solver: "forceAtlas2Based",
    timestep: 0.5,
    stabilization: { iterations: 1000 }
  },
  nodes: {
    shape: "dot",
    size: 10,
    scaling: {
      label: {
        drawThreshold: 5,
        maxVisible: 40
      }
    }
  },
  interaction: {
    tooltipDelay: 100,
    hideEdgesOnDrag: false,
    hideEdgesOnZoom: false,
  }
};
const GROUP_BY_ITSELF = "@@GROUP_BY_ITSELF@@"
const EXTENSION_NAME = "network-graph-ef-viz::network-graph-ef-viz";

const getOptions = function (config: VisConfig): VisOptions {
  const options: VisOptions = {};

  const dimensions = config.query_fields.dimensions.map(dimension => ({ label: dimension.label, name: dimension.name }))
  const measures = config.query_fields.measures.map(measure => ({ label: measure.label, name: measure.name }))

  options.from = {
    section: "Main",
    required: true,
    label: "From",
    type: "string",
    display: "select",
    values: [{ "--": "" }, ...dimensions.map(dimension => ({ [dimension.label]: dimension.name }))],
    default: ""
  }
  options.fromLabel = {
    section: "Main",
    label: "From Label",
    type: "string",
    display: "select",
    values: [{ "--": "" }, ...dimensions.map(dimension => ({ [dimension.label]: dimension.name }))],
    default: ""
  }
  options.to = {
    section: "Main",
    required: true,
    label: "To",
    type: "string",
    display: "select",
    values: [{ "--": "" }, ...dimensions.map(dimension => ({ [dimension.label]: dimension.name }))],
    default: ""
  }
  options.toLabel = {
    section: "Main",
    label: "To Label",
    type: "string",
    display: "select",
    values: [{ "--": "" }, ...dimensions.map(dimension => ({ [dimension.label]: dimension.name }))],
    default: ""
  }
  options.weight = {
    section: "Main",
    label: "Weight",
    type: "string",
    display: "select",
    values: [{ "--": "" }, ...measures.map(measure => ({ [measure.label]: measure.name })), ...dimensions.map(dimension => ({ [dimension.label]: dimension.name }))],
    default: ""
  }
  options.fromGroup = {
    order: 1,
    section: "_Advanced",
    label: "From Group by",
    type: "string",
    display: "select",
    values: [{ "No grouping": "" }, { "Itself": GROUP_BY_ITSELF }, ...dimensions.map(dimension => ({ [dimension.label]: dimension.name }))],
    default: ""
  }
  options.toGroup = {
    order: 2,
    section: "_Advanced",
    label: "To Group by",
    type: "string",
    display: "select",
    values: [{ "No grouping": "" }, { "Itself": GROUP_BY_ITSELF }, ...dimensions.map(dimension => ({ [dimension.label]: dimension.name }))],
    default: ""
  }
  options.fromLabelShow = {
    order: 3,
    section: "_Advanced",
    label: "Show From nodes label always",
    type: "boolean",
    default: false
  }
  options.toLabelShow = {
    order: 4,
    section: "_Advanced",
    label: "Show To nodes label always",
    type: "boolean",
    default: false
  }

  return options;
}

const getGroupForNode = function (row: any, node: string, group: string) {
  return group ? group === GROUP_BY_ITSELF ? node : row[group].value : undefined;
}

const updateGraph = function (network: Network, data: VisData, config: VisConfig) {
  if (!config.from || !config.to) {
    console.info("Missing from/to");
    //TODO: show error
    return;
  }

  const graph: any = {
    edges: [],
    nodes: [],
    groups: []
  }

  const nodesFrom: { [key: string]: any } = {}
  const nodesTo: { [key: string]: any } = {}

  for (const row of data) {
    nodesFrom[row[config.from].value] = row;
    nodesTo[row[config.to].value] = row;

    graph.edges.push({
      from: "f_" + row[config.from].value,
      to: "t_" + row[config.to].value,
      value: config.weight ? row[config.weight].value : undefined
    });
  }

  graph.nodes = Object.entries(nodesFrom).map(([id, row]) => (
    {
      id: `f_${id}`,
      title: config.fromLabel ? row[config.fromLabel].value : id,
      label: config.fromLabelShow ? config.fromLabel ? row[config.fromLabel].value : id : undefined,
      group: getGroupForNode(row, config.from, config.fromGroup)
    }))
    .concat(Object.entries(nodesTo).map(([id, row]) => (
      {
        id: `t_${id}`,
        title: config.toLabel ? row[config.toLabel].value : id,
        label: config.toLabelShow ? config.toLabel ? row[config.toLabel].value : id : undefined,
        group: getGroupForNode(row, config.to, config.toGroup)
      })));

  network.setData(graph);
}

const LinkToFullExtension: React.FC<{ url: string }> = function ({ url }) {
  console.log(document.referrer)
  const match = document.referrer.match(/.*qid=([^&]+)/);
  const slug = match && match[1];
  const src = `${window.location.protocol}//${window.location.host}/extensions/${EXTENSION_NAME}/${slug}`;

  return <div className="link-to-full">
    {slug && <Link href={src} target="_blank">View more results</Link>}
  </div>
}

const ProgressBar: React.FC<{ progress: number }> = function ({ progress }) {
  return <div className="loading-overlay">
    <Spinner size={60} markers={20} markerRadius={50} color="blue" speed={2000} />
    <div>{Math.ceil(progress * 100)}%</div>
  </div>
}

const NetworkGraph: React.FC<{ data: VisData, config: VisConfig }> = function ({ data, config }) {
  const visElement = useRef<HTMLDivElement>(null);
  const network = useRef<Network>();
  const [progress, setProgress] = useState(0);
  const [stabilizing, setStabilizing] = useState(false);

  useEffect(() => {
    if (!network.current) {
      network.current = new Network(visElement.current!, {}, options);
      network.current.on("stabilizationIterationsDone", () => {
        setProgress(0);
        setStabilizing(false);
      });
      network.current.on("stabilizationProgress", ({ iterations, total }) => {
        setStabilizing(true);
        setProgress(iterations / total)
      });
    }

    updateGraph(network.current, data, config);
  }, [data, config]);


  return <div style={{ height: "100%" }}>
    <div className="graph-container" ref={visElement}></div>
    <LinkToFullExtension url={document.referrer} />
    {stabilizing && <ProgressBar progress={progress} />}
  </div>
}

const vis: NetworkGraphViz = {
  id: 'network-graph-viz', // id/label not required, but nice for testing and keeping manifests in sync
  label: 'Network Graph',
  options: {},
  // Set up the initial state of the visualization
  create(element, config) {
    this.elementRef = element;
  },
  // Render in response to the data or settings changing
  updateAsync(data, element, config, queryResponse, details, done) {
    const errors = handleErrors(this, queryResponse, {
      min_pivots: 0,
      max_pivots: 0,
      min_dimensions: 2
    });
    if (errors) { // errors === true means no errors
      ReactDOM.render(
        <ComponentsProvider>
          <NetworkGraph data={data} config={config} />
        </ComponentsProvider>, element);
      this.trigger("registerOptions", getOptions(config));

      done();
    }
  }
};

looker.plugins.visualizations.add(vis);
