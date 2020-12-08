import React, { useContext, useEffect, useState, useRef } from "react";
import {
  ExtensionContext,
  ExtensionContextData
} from "@looker/extension-sdk-react";
import { Network } from "vis-network/standalone";
import { Button, Card, CardContent, Heading, Slider, Spinner } from "@looker/components";
import "./App.css";

const GROUP_BY_ITSELF = "@@GROUP_BY_ITSELF@@"

const getGroupForNode = function (row: any, node: string, group: string) {
  return group ? group === GROUP_BY_ITSELF ? node : row[group] : undefined;
}

const updateGraph = function (network: Network, data: any, config: any) {
  if (!config.from || !config.to) {
    console.error("Missing from/to");
    //TODO: show error
    return;
  }
  network.setOptions({ physics: { enabled: true } });

  const graph: any = {
    edges: [],
    nodes: [],
    groups: []
  }

  const nodesFrom: { [key: string]: any } = {}
  const nodesTo: { [key: string]: any } = {}

  for (const row of data) {
    nodesFrom[row[config.from]] = row;
    nodesTo[row[config.to]] = row;

    graph.edges.push({
      from: "f_" + row[config.from],
      to: "t_" + row[config.to],
      value: config.weight ? row[config.weight] : undefined
    });
  }

  graph.nodes = Object.entries(nodesFrom).map(([id, row]) => (
    {
      id: `f_${id}`,
      title: config.fromLabel ? row[config.fromLabel] : id,
      label: config.fromLabelShow ? config.fromLabel ? row[config.fromLabel] : id : undefined,
      group: getGroupForNode(row, config.from, config.fromGroup)
    }))
    .concat(Object.entries(nodesTo).map(([id, row]) => (
      {
        id: `t_${id}`,
        title: config.toLabel ? row[config.toLabel] : id,
        label: config.toLabelShow ? config.toLabel ? row[config.toLabel] : id : undefined,
        group: getGroupForNode(row, config.to, config.toGroup)
      })));

  network.setData(graph);
}

const ProgressBar: React.FC<{ progress?: number, text?: string }> = function ({ progress, text }) {
  return <div className="loading-overlay">
    <Spinner size={60} markers={20} markerRadius={50} color="blue" speed={2000} />
    {text && <Heading>{text}</Heading>}
    {progress && <Heading>{Math.ceil(progress * 100)}%</Heading>}
  </div>
}

export const App: React.FC<{}> = function () {
  const extensionContext = useContext<ExtensionContextData>(ExtensionContext);
  const extensionHost = extensionContext.extensionSDK;
  const sdk = extensionContext.core40SDK;
  const visElement = useRef<HTMLDivElement>(null);
  const network = useRef<Network>();
  const [progress, setProgress] = useState(0);
  const [stabilizing, setStabilizing] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [limit, setLimit] = useState(200);
  const slug = extensionHost.lookerHostData?.route?.replace("/", "");

  const executeQuery = async function (slug: string) {
    setQuerying(true);
    const query = await sdk.ok(sdk.query_for_slug(slug));
    const queryResponse = await sdk.ok(sdk.run_query({ query_id: query.id!, result_format: "json", limit })) as any;
    setQuerying(false);
    setStabilizing(true);
    updateGraph(network.current!, queryResponse, query.vis_config)
  }

  useEffect(() => {
    const options = {
      autoResize: true,
      height: "100%",
      width: "100%",
      edges: {
        smooth: {
          type: 'continuous'
        },
      },
      physics: {
        enabled: true,
        forceAtlas2Based: {
          gravitationalConstant: -26,
          centralGravity: 0.005,
          springLength: 230,
          springConstant: 0.18,
        },
        maxVelocity: 50,
        minVelocity: 1,
        solver: "forceAtlas2Based",
        timestep: 0.5,
        stabilization: { iterations: 5000 },
      },
      nodes: {
        shape: "dot",
        size: 10,
        scaling: {
          label: {
            drawThreshold: 8,
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
    if (!network.current) {
      //@ts-ignore
      network.current = new Network(visElement.current!, {}, options);
      network.current?.on("stabilizationIterationsDone", () => {
        network.current?.setOptions({ physics: { enabled: false } });
        setProgress(0);
        setStabilizing(false);
      });
      network.current?.on("stabilizationProgress", ({ iterations, total }) => {
        setStabilizing(true);
        setProgress(iterations / total)
      });
    }
    slug && executeQuery(slug);
  }, [slug]);


  return <div className="mains-container">
    <div className="graph-container" ref={visElement}></div>
    {stabilizing && <ProgressBar text="Preparing graph..." progress={progress} />}
    {querying && <ProgressBar text="Executing Query..." />}
    <Card className="graph-options">
      <CardContent>
        <Heading as="h4">Limit:</Heading>
        <Slider min={0} max={6000} step={50} value={limit} onChange={(evt: any) => setLimit(evt.target.value)} />
        <br />
        <Button disabled={querying} onClick={() => executeQuery(slug!)}>Execute</Button>
      </CardContent>
    </Card>
  </div>
}