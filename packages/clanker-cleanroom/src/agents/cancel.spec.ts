import { describe, expect } from "vitest";
import test from "vitest-gwt";

import {
  CLANKER_LABEL_PARENT,
  forceRemoveContainerTree,
  type DockerCli,
} from "./cancel.js";

type Context = {
  dockerCli: DockerCli;
  calls: string[][];
  childrenByParent: Record<string, string[]>;
};

describe("forceRemoveContainerTree", () => {
  test("removes children before the parent", {
    given: {
      stub_docker_with_nested_children,
    },
    when: {
      removing_tree_for_root,
    },
    then: {
      removed_grandchild_then_child_then_root,
    },
  });

  test("removes a leaf with no children", {
    given: {
      stub_docker_with_no_children,
    },
    when: {
      removing_tree_for_leaf,
    },
    then: {
      only_removed_leaf,
    },
  });
});

function stub_docker_with_nested_children(this: Context) {
  this.calls = [];
  this.childrenByParent = {
    root: ["child"],
    child: ["grandchild"],
    grandchild: [],
  };
  this.dockerCli = async (args) => {
    this.calls.push(args);
    if (args[0] === "ps") {
      const filter = args.find((arg) => arg.startsWith(`label=${CLANKER_LABEL_PARENT}=`));
      const parent = filter?.slice(`label=${CLANKER_LABEL_PARENT}=`.length) ?? "";
      const names = this.childrenByParent[parent] ?? [];
      return { exitCode: 0, stdout: `${names.join("\n")}\n`, stderr: "" };
    }
    return { exitCode: 0, stdout: "", stderr: "" };
  };
}

function stub_docker_with_no_children(this: Context) {
  this.calls = [];
  this.childrenByParent = {};
  this.dockerCli = async (args) => {
    this.calls.push(args);
    return { exitCode: 0, stdout: "", stderr: "" };
  };
}

async function removing_tree_for_root(this: Context) {
  await forceRemoveContainerTree("root", this.dockerCli);
}

async function removing_tree_for_leaf(this: Context) {
  await forceRemoveContainerTree("leaf", this.dockerCli);
}

function removed_grandchild_then_child_then_root(this: Context) {
  const rms = this.calls.filter((args) => args[0] === "rm");
  expect(rms).toEqual([
    ["rm", "-f", "grandchild"],
    ["rm", "-f", "child"],
    ["rm", "-f", "root"],
  ]);
}

function only_removed_leaf(this: Context) {
  const rms = this.calls.filter((args) => args[0] === "rm");
  expect(rms).toEqual([["rm", "-f", "leaf"]]);
}
