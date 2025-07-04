import * as React from "react";

import styles from "manager/content-management/shared/components/panels/sources/channels/channels-selection.module.scss";

import { BaseChannelType, ChannelTreeType, ChildChannelType } from "core/channels/type/channels.type";

import { Form, Select } from "components/input";
import { Highlight } from "components/table/Highlight";

import { Org } from "../types";
import SyncChannelProcessor from "./sync-channels-processor";

type Props = {
  rowDefinition: ChannelTreeType;
  search: string;
  openRows: Set<number>;
  selectedRows: Set<number>;
  syncedRows: Set<number>;
  channelProcessor: Readonly<SyncChannelProcessor>;
  onToggleChannelSelect: (channel: BaseChannelType | ChildChannelType, toState?: boolean) => void;
  onToggleChannelOpen: (channel: BaseChannelType) => void;
  onOrgSelect: (channelId: number, org?: Org) => void;
};

const SyncChannelTree = (props: Props) => {
  const { base, children } = props.rowDefinition;
  const { id, name } = base;
  const isOpen = props.openRows.has(id);
  const isSelected = props.selectedRows.has(id);
  const isSynced = props.syncedRows.has(id);
  const identifier = "base_" + id;

  const selectedChildrenCount = children
    .map((child) => child.id)
    .reduce((total: number, id) => {
      return total + Number(props.selectedRows.has(id));
    }, 0);
  const totalSelectedCount = Number(isSelected) + selectedChildrenCount;

  const renderChildChannel = (child: ChildChannelType) => {
    const childIsSelected = props.selectedRows.has(child.id);
    const childIsSynced = props.syncedRows.has(child.id);
    const syncData = props.channelProcessor.getSyncData(child.id);
    const childIdentifier = "child_" + child.id;

    return (
      <div key={child.id} className={`${styles.child_channel} ${childIsSynced ? "synced-channel-child" : ""}`}>
        <input
          type="checkbox"
          value={child.id}
          id={childIdentifier}
          name="childChannels"
          readOnly
          checked={childIsSelected}
          onClick={() => props.onToggleChannelSelect(child)}
        />
        <label className={`${styles.collapsible} ${styles.child_name}`} htmlFor={childIdentifier}>
          <Highlight
            enabled={props.search?.length > 0}
            text={`${child.name}${childIsSynced ? " ✓" : ""}`}
            highlight={props.search}
          />
        </label>

        {/* Add org selector for selected non-vendor channels */}
        {childIsSelected && syncData && syncData.channelOrg && (
          <div className="sync-org-selector">
            <Form>
              <Select
                name={`org-${child.id}`}
                placeholder={t("Select Org")}
                options={props.channelProcessor.availableOrgs}
                getOptionValue={(org: Org) => org.orgId.toString()}
                getOptionLabel={(org: Org) => org.orgName}
                defaultValue={syncData.selectedPeripheralOrg?.orgId.toString()}
                onChange={(_, orgId: string) => {
                  const org = props.channelProcessor.availableOrgs.find((o) => o.orgId === Number(orgId));
                  props.onOrgSelect(child.id, org);
                }}
                disabled={syncData.strictOrg}
              />
            </Form>
          </div>
        )}
      </div>
    );
  };

  return (
    <React.Fragment>
      <h4
        className={`${styles.base_channel} ${isSynced ? "synced-channel-base" : ""}`}
        onClick={() => props.onToggleChannelOpen(base)}
      >
        <input
          type="checkbox"
          id={identifier}
          name={identifier}
          className={styles.toggle}
          readOnly
          checked={isSelected}
          value={id}
          onClick={(event) => {
            event.stopPropagation();
            props.onToggleChannelSelect(base);
          }}
        />
        <i className={`${styles.arrow} fa ${isOpen ? "fa-angle-down" : "fa-angle-right"}`} />
        <Highlight
          className={styles.collapsible}
          enabled={props.search.length > 0}
          text={`${name}${isSynced ? " ✓" : ""}`}
          highlight={props.search}
        />
        {totalSelectedCount > 0 && <b className={styles.count}>{`(${totalSelectedCount})`}</b>}
      </h4>

      {isOpen && (
        <React.Fragment>
          {children.length === 0 ? (
            <div className={styles.child_channel}>
              <span>&nbsp;{t("no child channels")}</span>
            </div>
          ) : (
            children.map(renderChildChannel)
          )}
        </React.Fragment>
      )}
    </React.Fragment>
  );
};

export default SyncChannelTree;
