const GroupsPage = {
    view() {
        return m(Layout, [
            m('div.page-header', [
                m('h1', '群组')
            ]),
            m(EmptyState, { 
                message: '暂无群组', 
                icon: 'fa-users' 
            })
        ]);
    }
};

const ActivityPage = {
    view() {
        return m(Layout, [
            m('div.page-header', [
                m('h1', '活动')
            ]),
            m(EmptyState, { 
                message: '暂无活动', 
                icon: 'fa-chart-line' 
            })
        ]);
    }
};

const MilestonesPage = {
    view() {
        return m(Layout, [
            m('div.page-header', [
                m('h1', '里程碑')
            ]),
            m(EmptyState, { 
                message: '暂无里程碑', 
                icon: 'fa-flag' 
            })
        ]);
    }
};

const SnippetsPage = {
    view() {
        return m(Layout, [
            m('div.page-header', [
                m('h1', '代码片段')
            ]),
            m(EmptyState, { 
                message: '暂无代码片段', 
                icon: 'fa-code' 
            })
        ]);
    }
};

export { GroupsPage, ActivityPage, MilestonesPage, SnippetsPage };
