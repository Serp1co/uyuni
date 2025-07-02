// SyncBaseChannel.tsx
import * as React from "react";

import BaseChannel from "manager/content-management/shared/components/panels/sources/channels/base-channel";

import { BaseChannelType, ChannelTreeType, ChildChannelType } from "core/channels/type/channels.type";

import SyncChannelProcessor from "./sync-channels-processor";

type Props = {
  rowDefinition: ChannelTreeType;
  search: string;
  openRows: Set<number>;
  selectedRows: Set<number>;
  syncedRows: Set<number>;
  selectedBaseChannelId: number | undefined;
  channelProcessor: Readonly<SyncChannelProcessor>;
  onToggleChannelSelect: (channel: BaseChannelType | ChildChannelType, toState?: boolean) => void;
  onToggleChannelOpen: (channel: BaseChannelType) => void;
};

const SyncBaseChannel = (props: Props) => {
  // Since BaseChannel renders children internally, we need to enhance the entire tree
  const enhancedRowDefinition = React.useMemo(() => {
    const { base, children } = props.rowDefinition;
    const isSynced = props.syncedRows.has(base.id);

    return {
      base: {
        ...base,
        name: `${base.name}${isSynced ? " ✓" : ""}`,
      },
      children: children.map((child) => ({
        ...child,
        name: `${child.name}${props.syncedRows.has(child.id) ? " ✓" : ""}`,
      })),
    };
  }, [props.rowDefinition, props.syncedRows]);

  const baseIsSynced = props.syncedRows.has(props.rowDefinition.base.id);

  return (
    <div className={baseIsSynced ? "synced-channel" : ""}>
      <BaseChannel
        {...props}
        rowDefinition={enhancedRowDefinition}
        selectedBaseChannelId={props.selectedBaseChannelId}
      />
    </div>
  );
};

export default SyncBaseChannel;
